#!/usr/bin/env bash
set -euo pipefail

# Secret-safe local preflight and human-gated Tinybird verification.
# This script never prints token values and never deploys resources.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DATASOURCE_FILE="$SCRIPT_DIR/datasources/events.datasource"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

static_check() {
  [[ -f "$DATASOURCE_FILE" ]] || fail "events datasource file is missing"

  local required_column
  for required_column in event_name timestamp org_id user_id session_id properties source ip; do
    grep -Eq '^[[:space:]]*`'"${required_column}"'`[[:space:]]' "$DATASOURCE_FILE" \
      || fail "events datasource is missing column: ${required_column}"
  done

  grep -Eq '^TOKEN[[:space:]]+learnhouse_events_ingest[[:space:]]+APPEND[[:space:]]*$' "$DATASOURCE_FILE" \
    || fail "events datasource is missing the learnhouse_events_ingest APPEND token"
  grep -Eq '^TOKEN[[:space:]]+learnhouse_events_read[[:space:]]+READ[[:space:]]*$' "$DATASOURCE_FILE" \
    || fail "events datasource is missing the learnhouse_events_read READ token"
  grep -Eq 'ENGINE[[:space:]]+"MergeTree"' "$DATASOURCE_FILE" \
    || fail "events datasource must use MergeTree"
  grep -Eq 'ENGINE_PARTITION_KEY[[:space:]]+"toYYYYMM\(timestamp\)"' "$DATASOURCE_FILE" \
    || fail "events datasource must be partitioned by timestamp month"
  grep -Eq 'ENGINE_TTL[[:space:]]+"timestamp[[:space:]]*\+[[:space:]]*toIntervalDay\(365\)"' "$DATASOURCE_FILE" \
    || fail "events datasource must retain data for 365 days"

  printf 'STATIC_CHECK=passed\n'
  if command -v tb >/dev/null 2>&1; then
    printf 'TB_CLI=available\n'
    printf 'LIVE_GATE=run tb --cloud deploy --check from the Tinybird project\n'
  else
    printf 'TB_CLI=missing\n'
    printf 'LIVE_GATE_REQUIRED=tb --cloud deploy --check (run by a human with the workspace CLI)\n'
  fi
}

readiness_check() {
  local missing=()
  [[ -n "${LEARNHOUSE_TINYBIRD_API_URL:-}" ]] || missing+=(LEARNHOUSE_TINYBIRD_API_URL)
  [[ -n "${LEARNHOUSE_TINYBIRD_INGEST_TOKEN:-}" ]] || missing+=(LEARNHOUSE_TINYBIRD_INGEST_TOKEN)
  [[ -n "${LEARNHOUSE_TINYBIRD_READ_TOKEN:-}" ]] || missing+=(LEARNHOUSE_TINYBIRD_READ_TOKEN)

  if ((${#missing[@]} > 0)); then
    printf 'RUNTIME_CONFIG=incomplete\n'
    printf 'MISSING_VARIABLES=%s\n' "${missing[*]}"
    return 2
  fi

  case "$LEARNHOUSE_TINYBIRD_API_URL" in
    http://*|https://*) ;;
    *) fail 'LEARNHOUSE_TINYBIRD_API_URL must start with http:// or https://' ;;
  esac

  printf 'RUNTIME_CONFIG=complete\n'
}

live_verify() {
  command -v curl >/dev/null 2>&1 || fail "curl is required for live verification"

  local probe_session_id probe_timestamp append_status
  probe_session_id="tinybird-bootstrap-$(date -u '+%Y%m%dT%H%M%S')-$$"
  probe_timestamp="$(date -u '+%Y-%m-%d %H:%M:%S')"
  append_status="$(curl --fail --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --request POST \
    --url "${LEARNHOUSE_TINYBIRD_API_URL%/}/v0/events?name=events" \
    --header "Authorization: Bearer $LEARNHOUSE_TINYBIRD_INGEST_TOKEN" \
    --header 'Content-Type: application/json' \
    --data "{\"event_name\":\"bootstrap_check\",\"timestamp\":\"$probe_timestamp\",\"org_id\":0,\"user_id\":0,\"session_id\":\"$probe_session_id\",\"properties\":\"{}\",\"source\":\"bootstrap\",\"ip\":\"127.0.0.1\"}")" \
    || fail "Tinybird append request failed"
  [[ "$append_status" == 2* ]] || fail "Tinybird append returned HTTP ${append_status}"
  # A successful append proves that the scoped API URL resolves the events
  # datasource; no separate CLI listing is used, avoiding cross-workspace defaults.
  printf 'DATASOURCE_CHECK=passed\n'
  printf 'APPEND_CHECK=passed\n'

  local query_attempt query_status query_output
  query_output="$(mktemp)"
  trap 'rm -f "$query_output"' RETURN
  for ((query_attempt = 1; query_attempt <= 15; query_attempt++)); do
    query_status="$(curl --fail --silent --show-error --output "$query_output" --write-out '%{http_code}' \
      --request POST \
      --url "${LEARNHOUSE_TINYBIRD_API_URL%/}/v0/sql" \
      --header "Authorization: Bearer $LEARNHOUSE_TINYBIRD_READ_TOKEN" \
      --data-urlencode "q=SELECT count() AS bootstrap_check_count FROM events WHERE event_name = 'bootstrap_check' AND session_id = '$probe_session_id' FORMAT JSON")" \
      || fail "Tinybird query request failed"
    [[ "$query_status" == 2* ]] || fail "Tinybird query returned HTTP ${query_status}"
    if command -v python3 >/dev/null 2>&1; then
      if python3 - "$query_output" 2>/dev/null <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as response_file:
    response = json.load(response_file)

rows = response.get("data", [])
value = rows[0].get("bootstrap_check_count") if rows else None
raise SystemExit(0 if value in (1, "1") else 1)
PY
      then
        printf 'READ_CHECK=passed\n'
        return 0
      fi
    elif command -v python >/dev/null 2>&1; then
      if python - "$query_output" 2>/dev/null <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as response_file:
    response = json.load(response_file)

rows = response.get("data", [])
value = rows[0].get("bootstrap_check_count") if rows else None
raise SystemExit(0 if value in (1, "1") else 1)
PY
      then
        printf 'READ_CHECK=passed\n'
        return 0
      fi
    elif grep -Eq '"bootstrap_check_count"[[:space:]]*:[[:space:]]*1([,}])' "$query_output"; then
      printf 'READ_CHECK=passed\n'
      return 0
    fi
    if ((query_attempt < 15)); then
      sleep 2
    fi
  done
  fail "Tinybird query did not return count=1 for the probe after 15 attempts"
}

mode="${1:---static-check}"
case "$mode" in
  --static-check)
    static_check
    ;;
  --check)
    static_check
    readiness_check
    ;;
  --verify-live)
    readiness_check
    live_verify
    ;;
  *)
    printf 'Usage: %s [--static-check|--check|--verify-live]\n' "$0" >&2
    exit 2
    ;;
esac
