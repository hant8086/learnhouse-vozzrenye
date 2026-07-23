import "server-only";
/**
 * Active-user overage billing.
 *
 * The backend (apps/api) computes the number of active users (members seen on
 * >=2 distinct UTC days in a month) and the billable overage beyond the plan's
 * included member limit. This module pulls that number and adds it as a single
 * line on the org's existing subscription invoice — no separate charge.
 *
 * Primary path: the `invoice.created` webhook (billOverageForInvoice) adds the
 * line to that specific draft invoice before Stripe finalizes it. A cron
 * (billAllActiveUserOverage) is a backstop for any invoice that missed the
 * hook. Both are idempotent per (org, year, month).
 */
import { getServerAPIUrl } from "@services/config/config";
import { getStripeSecretKey } from "@services/billing/stripe";

let _stripeClient: any = null;
const stripe: any = new Proxy(
  {},
  {
    get(_t, prop) {
      if (!_stripeClient) {
        const key = getStripeSecretKey();
        if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
        _stripeClient = require("stripe")(key);
      }
      return _stripeClient[prop];
    },
  },
);

// $1 / €1 per active user over the included limit (one minor-unit-hundred).
const OVERAGE_UNIT_AMOUNT = 100;
// Only these plans carry active-user overage.
const BILLABLE_PLANS = new Set(["standard", "pro"]);

type OverageSummary = {
  org_id: number;
  plan: string;
  year: number;
  month: number;
  active_users: number;
  plan_limit: number;
  overage_units: number;
  overage_usd: number;
};

/** Pull the active-user overage for an org/month from the backend (platform-key auth). */
export async function fetchActiveUserOverage(
  orgId: string,
  year: number,
  month: number,
): Promise<OverageSummary | null> {
  const url = `${getServerAPIUrl()}internal/packs/${orgId}/active-user-overage?year=${year}&month=${month}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "x-platform-key": process.env.LEARNHOUSE_PLATFORM_API_KEY || "" },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "overage fetch failed" }));
    throw new Error(err.detail || `overage fetch failed (${res.status})`);
  }
  return res.json();
}

/** Calendar month immediately preceding a UTC date (the month whose usage a
 *  freshly-created invoice bills in arrears). */
function previousCalendarMonth(dateUtc: Date): { year: number; month: number } {
  let year = dateUtc.getUTCFullYear();
  let month = dateUtc.getUTCMonth() + 1; // 1-12
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return { year, month };
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** True if this org/period was already billed (webhook or a prior cron run),
 *  so retries and the cron backstop never double-charge. */
async function alreadyBilled(customerId: string, period: string): Promise<boolean> {
  const items = await stripe.invoiceItems.list({ customer: customerId, limit: 100 });
  return items.data.some(
    (it: any) => it?.metadata?.type === "au_overage" && it?.metadata?.au_period === period,
  );
}

/**
 * Core: add the overage line for one org/month. When invoiceId is given the
 * item attaches to that specific (draft) invoice; otherwise it becomes a
 * pending item on the customer's next invoice (cron backstop).
 */
async function billOverage(params: {
  orgId: string;
  customerId: string;
  currency: string;
  year: number;
  month: number;
  invoiceId?: string;
}): Promise<{ billed: boolean; reason?: string; overage_units?: number }> {
  const { orgId, customerId, currency, year, month, invoiceId } = params;

  const summary = await fetchActiveUserOverage(orgId, year, month);
  if (!summary) return { billed: false, reason: "no summary" };
  if (!BILLABLE_PLANS.has(summary.plan)) return { billed: false, reason: `plan ${summary.plan}` };
  if (summary.overage_units <= 0) return { billed: false, reason: "no overage" };

  const period = periodKey(year, month);
  if (await alreadyBilled(customerId, period)) {
    return { billed: false, reason: "already billed" };
  }

  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  await stripe.invoiceItems.create(
    {
      customer: customerId,
      ...(invoiceId ? { invoice: invoiceId } : {}),
      currency,
      unit_amount: OVERAGE_UNIT_AMOUNT,
      quantity: summary.overage_units,
      description: `Active users over plan — ${monthName} ${year} (${summary.active_users} active, ${summary.plan_limit} included)`,
      metadata: {
        org_id: orgId,
        type: "au_overage",
        au_period: period,
        active_users: String(summary.active_users),
        plan_limit: String(summary.plan_limit),
        overage_units: String(summary.overage_units),
      },
    },
    { idempotencyKey: `au-overage-${orgId}-${period}` },
  );

  return { billed: true, overage_units: summary.overage_units };
}

/**
 * Webhook entry (invoice.created). Adds last month's active-user overage as a
 * line on this subscription invoice before it finalizes. Only acts on regular
 * subscription-cycle (renewal) invoices for a plan subscription.
 */
export async function billOverageForInvoice(invoice: any): Promise<void> {
  // Renewals only: skip the first invoice (subscription_create), proration
  // updates, and manual invoices.
  if (invoice?.billing_reason !== "subscription_cycle") return;
  if (!invoice?.subscription || !invoice?.customer) return;

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const orgId = subscription?.metadata?.org_id;
  if (!orgId || subscription?.metadata?.type === "pack") return;

  const { year, month } = previousCalendarMonth(new Date(invoice.created * 1000));
  const result = await billOverage({
    orgId,
    customerId: invoice.customer,
    currency: invoice.currency,
    year,
    month,
    invoiceId: invoice.id,
  });
  console.log(
    `[au-overage] invoice ${invoice.id} org ${orgId} ${periodKey(year, month)}:`,
    JSON.stringify(result),
  );
}

/**
 * Cron backstop. Bills last calendar month's active-user overage for every org
 * with a plan subscription, as a pending invoice item on its next invoice.
 * Idempotent with the webhook path (same period check + idempotency key).
 */
export async function billAllActiveUserOverage(): Promise<{
  orgsChecked: number;
  billed: { orgId: string; units: number }[];
  skipped: number;
  errors: number;
}> {
  const { year, month } = previousCalendarMonth(new Date());
  const billed: { orgId: string; units: number }[] = [];
  let orgsChecked = 0;
  let skipped = 0;
  let errors = 0;

  let startingAfter: string | undefined;
  const seenOrgs = new Set<string>();
  for (let page = 0; page < 50; page++) {
    const res = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const sub of res.data) {
      const orgId = sub.metadata?.org_id;
      if (!orgId || sub.metadata?.type === "pack") continue;
      if (seenOrgs.has(String(orgId))) continue;
      seenOrgs.add(String(orgId));
      orgsChecked++;
      try {
        const result = await billOverage({
          orgId: String(orgId),
          customerId: sub.customer,
          currency: sub.currency,
          year,
          month,
        });
        if (result.billed) billed.push({ orgId: String(orgId), units: result.overage_units ?? 0 });
        else skipped++;
      } catch (err) {
        errors++;
        console.error(`[au-overage cron] failed for org ${orgId}:`, err);
      }
    }
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
  }

  return { orgsChecked, billed, skipped, errors };
}
