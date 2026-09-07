# Tinybird Analytics for LearnHouse

LearnHouse uses [Tinybird](https://www.tinybird.co/) (managed ClickHouse) for analytics event ingestion and querying. This directory contains the datasource schema and reference pipe definitions.

## Architecture

- **Ingestion**: The API sends events to Tinybird via the Events API (`POST /v0/events`)
- **Querying**: The API reads data via the Query API (`POST /v0/sql`) using raw ClickHouse SQL — pipe files in `endpoints/` are reference only and are **not deployed**
- **Config**: Analytics is enabled only when all three Tinybird env vars are non-empty. No `enabled` flag is needed.

## Prerequisites

1. A [Tinybird account](https://www.tinybird.co/)
2. The Tinybird CLI (`tb`) for the human-controlled deploy gate. Do not install it as part of an application deploy.
3. A workspace created in your preferred region (e.g. `europe-west2 (gcp)`)

## Environment Variables

Set these in your `.env` or deployment secrets:

```
LEARNHOUSE_TINYBIRD_API_URL=https://api.europe-west2.gcp.tinybird.co
LEARNHOUSE_TINYBIRD_INGEST_TOKEN=
LEARNHOUSE_TINYBIRD_READ_TOKEN=
```

- `LEARNHOUSE_TINYBIRD_API_URL` — Your workspace's regional API URL
- `LEARNHOUSE_TINYBIRD_INGEST_TOKEN` — Runtime token with append permission on the `events` datasource
- `LEARNHOUSE_TINYBIRD_READ_TOKEN` — Runtime token with SQL/query read permission

All three values are required together. If any value is missing or blank, the API leaves Tinybird unconfigured: event tracking is a no-op and analytics reads report that the integration is unavailable. This prevents an empty Bearer credential from being sent.

The redacted handoff template is [`env.example`](./env.example). Never commit or paste token values into this repository, logs, or chat.

### Finding Your API URL

Your API URL depends on the region of your workspace. Check the Tinybird dashboard or use:

```bash
tb workspace current
```

### Creating Tokens

In the Tinybird dashboard under **Tokens**, create two runtime tokens:

1. **Ingest token**: The `events.datasource` declaration creates `learnhouse_events_ingest` with append access on the `events` datasource only.
2. **Read token**: The `events.datasource` declaration creates `learnhouse_events_read` with read access. The API uses raw `POST /v0/sql`, so confirm this resource token is accepted for query access in the current workspace.

These declarations are deterministic resource-scoped token definitions, not token values. A human must deploy the datafile with the Forward-compatible CLI; the resulting runtime values must then be placed in the three LearnHouse secret variables. Resource creation and deployment use a separate admin/deployment credential, and the application runtime receives no datasource-creation permission.

## Local readiness and human-gated verification

Run the static, secret-safe preflight from this directory:

```bash
./bootstrap.sh --static-check
```

It validates the checked-in datasource shape and reports whether `tb` is available without printing credentials. If the CLI is unavailable, the required live gate is:

```bash
tb --cloud deploy --check
```

Run that command only with the Tinybird workspace selected by the human release owner. It is not run by this change and no Cloud resources are mutated here. With the three runtime values loaded in the operator environment, the readiness check is:

```bash
./bootstrap.sh --check
```

After the datasource deploy/check has generated and the human has approved the two resource token values, place those values in the runtime secrets and then run:

```bash
./bootstrap.sh --verify-live
```

This checks the `events` datasource through the configured host, then performs append and SQL read HTTP checks for one uniquely identified probe event using the current UTC timestamp. Because ingestion can be eventually consistent, the read is retried up to 15 times with two-second delays (28 seconds maximum) and succeeds only when structured JSON reports the probe count as numeric or string `1`. If Python is unavailable, a constrained JSON-text fallback is used. The helper never prints token values or response bodies.

## Initial Setup

### 1. Login to Tinybird CLI (human gate)

```bash
tb login
```

Follow the prompts to authenticate. This creates a `.tinyb` file (gitignored).

### 2. Deploy the Datasource

From this directory (`apps/api/src/db/tinybird/`):

```bash
# Deploy only the datasource (the endpoints/ pipes are reference-only)
# Move or exclude pipe files temporarily if they cause parsing errors
cd datasources/
tb --cloud deploy --check
tb --cloud deploy
```

The Forward deployment creates the two resource-scoped tokens declared at the top of `events.datasource`. Capture their generated values through the approved secret handoff only; never commit or print them. Map `learnhouse_events_ingest` to `LEARNHOUSE_TINYBIRD_INGEST_TOKEN` and `learnhouse_events_read` to `LEARNHOUSE_TINYBIRD_READ_TOKEN`.

Or from the tinybird root directory, if pipe files parse cleanly:

```bash
tb --cloud deploy
```

**Important**: If your workspace uses **Forward mode** (the default for new workspaces), all resource creation must go through `tb deploy`. You cannot create datasources via the v0 API directly.

### 3. Verify Deployment

```bash
# List datasources
tb datasource ls

# You should see the 'events' datasource
```

### 4. Test Event Ingestion

```bash
curl -X POST \
  'https://api.europe-west2.gcp.tinybird.co/v0/events?name=events' \
  -H "Authorization: Bearer $LEARNHOUSE_TINYBIRD_INGEST_TOKEN" \
  -d '{"event_name":"test","timestamp":"2025-01-01 00:00:00","org_id":1,"user_id":1,"session_id":"test","properties":"{}","source":"test","ip":"127.0.0.1"}'
```

### 5. Test Query API

```bash
curl -X POST \
  'https://api.europe-west2.gcp.tinybird.co/v0/sql' \
  -H "Authorization: Bearer $LEARNHOUSE_TINYBIRD_READ_TOKEN" \
  -d "SELECT count() FROM events FORMAT JSON"
```

## Directory Structure

```
tinybird/
  datasources/
    events.datasource    # Datasource, resource token declarations, and schema
  endpoints/
    *.pipe               # Reference pipe definitions (NOT deployed)
  bootstrap.sh           # Secret-safe preflight/live verification helper
  env.example            # Redacted runtime variable handoff
  README.md              # This file
```

### Why Pipes Are Not Deployed

LearnHouse uses the Tinybird **Query API** (`POST /v0/sql`) to run ClickHouse SQL directly, rather than deploying pipe endpoints. This approach:

- Avoids Forward mode deployment complexity for pipes
- Keeps all query logic in the Python codebase (`src/services/analytics/queries.py`)
- Makes it easy to add/modify queries without redeploying Tinybird resources

The pipe files in `endpoints/` serve as documentation of the available queries and their expected schemas.

## LearnHouse deployment handoff

For the production host, store the three real values only in the deployment secret file documented by the LearnHouse process (currently `/root/.learnhouse/default/.env`). Do not put them in compose files, this repository, command history, or chat. After the human gate approves the datasource and token scopes, restart only the LearnHouse API service and verify the authorized `/api/v1/analytics/status` response reports `configured: true`. Keep the previous compose/image backup and revert only that service if startup or health verification fails.

The application sends API and frontend events to `POST /v0/events?name=events` and reads predefined analytics SQL through `POST /v0/sql`; the endpoint files in this directory are reference-only. A custom Tinybird host must support both paths, use the workspace's regional API base URL, and preserve TLS and token/resource compatibility. Different workspace regions, Forward deployment mode, and unverified token scope labels are live-gate risks.

## Datasource Schema

The `events` datasource is a single unified table:

| Column | Type | Description |
|--------|------|-------------|
| `event_name` | String | Event identifier (e.g. `page_view`, `course_enrolled`) |
| `timestamp` | DateTime | UTC timestamp |
| `org_id` | Int64 | Organization ID |
| `user_id` | Int64 | User ID (0 for anonymous) |
| `session_id` | String | Browser session ID |
| `properties` | String | JSON-encoded event properties |
| `source` | String | `api` or `frontend` |
| `ip` | String | Client IP address |

- Partitioned by month (`toYYYYMM(timestamp)`)
- Sorted by `(org_id, event_name, timestamp)`
- 12-month TTL

## Deleting Everything / Starting Fresh

### Delete the Datasource

To remove the `events` datasource and all its data:

```bash
# Option 1: Deploy an empty project (removes all resources)
# Create a temp empty directory and deploy from it
mkdir /tmp/tb-empty && cd /tmp/tb-empty
tb --cloud deploy

# Then promote the deployment to live
tb deployment ls
tb deployment set-live <deployment-id>

# Clean up
rm -rf /tmp/tb-empty
```

```bash
# Option 2: Delete via API (only works in Classic mode, NOT Forward mode)
curl -X DELETE \
  'https://api.europe-west2.gcp.tinybird.co/v0/datasources/events' \
  -H "Authorization: Bearer $LEARNHOUSE_TINYBIRD_INGEST_TOKEN"
```

### Delete Deployment History

```bash
# List all deployments
tb deployment ls

# Delete a specific deployment (cannot delete the live one)
tb deployment delete <deployment-id>
```

### Re-deploy from Scratch

After deleting, follow the [Initial Setup](#initial-setup) steps again.

## Troubleshooting

### "Adding or modifying data sources can only be done via deployments"
Your workspace is in **Forward mode**. Use `tb --cloud deploy` instead of the v0 API.

### "Resource 'events' not found"
The datasource hasn't been deployed yet. Follow the [Initial Setup](#initial-setup) steps.

### "Datasource events not found" on event ingestion
Same as above — the Events API cannot auto-create datasources in Forward mode.

### Dashboard shows "Analytics not configured"
One or more of `LEARNHOUSE_TINYBIRD_API_URL`, `LEARNHOUSE_TINYBIRD_INGEST_TOKEN`, and `LEARNHOUSE_TINYBIRD_READ_TOKEN` is not set or is blank. Set all three together to enable analytics.

### Dashboard queries return empty data
If the `events` table exists but has no data, queries will return empty results. Send some test events or use the app to generate real events.
