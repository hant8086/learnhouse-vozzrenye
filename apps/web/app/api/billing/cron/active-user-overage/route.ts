import { NextRequest, NextResponse } from "next/server";
import { billAllActiveUserOverage } from "@services/billing/activeUserBilling";
import { guardBilling, requireCronSecret } from "../../_lib";

// GET /api/billing/cron/active-user-overage  (header: x-cron-secret: $CRON_SECRET)
//
// Backstop for active-user overage billing. The `invoice.created` webhook is
// the primary path (adds the overage line to each org's renewal invoice); this
// monthly job catches any invoice that missed the hook. Idempotent with the
// webhook — it re-checks each org/period and skips anything already billed.
// Iterates ALL orgs, so it is gated by the shared cron secret.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const blocked = await guardBilling();
  if (blocked) return blocked;

  const forbidden = requireCronSecret(request);
  if (forbidden) return forbidden;

  try {
    const result = await billAllActiveUserOverage();
    console.log("[billing/cron/active-user-overage]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[billing/cron/active-user-overage] failed:", err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
