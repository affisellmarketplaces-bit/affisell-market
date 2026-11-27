/**
 * Payout preflight on a REAL PostgreSQL (local throwaway database only): seeds one order with its ledger, attempt,
 * Connect account, refund and webhook rows, runs the real gatherer (its exact SQL, through psql) with a fake Stripe,
 * and checks every verdict. Cleans up its own rows.
 *
 *   PGHOST=/tmp PGPORT=55432 PGUSER=postgres PGDATABASE=affi npx tsx scripts/sql/test-payout-preflight.ts
 *
 * Needs every repo migration applied. Refuses any non-local host.
 */
import { execFileSync } from "node:child_process"

import { evaluatePayoutPreflight } from "../../lib/finance/payout-preflight"
import { gatherPayoutPreflight, type PreflightStripe } from "../../lib/finance/payout-preflight.server"
import type { RawQueryable } from "../../lib/finance/money-invariants.server"
import { STRIPE_WEBHOOK_REQUIRED_EVENTS } from "../../lib/stripe-webhook-required-events"

const host = process.env.PGHOST ?? ""
if (!/^(\/|localhost$|127\.0\.0\.1$)/.test(host)) {
  console.error("refused: PGHOST must be a local socket dir or localhost")
  process.exit(2)
}

const psql = (sql: string) =>
  execFileSync("psql", ["-qAtX", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim()
const lit = (v: unknown): string =>
  v instanceof Date
    ? `'${v.toISOString()}'::timestamptz`
    : Array.isArray(v)
      ? `ARRAY[${v.map(lit).join(",") || "NULL"}]::text[]`
      : typeof v === "number"
        ? String(v)
        : `'${String(v).replace(/'/g, "''")}'`
const db: RawQueryable = {
  async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
    const bound = query.replace(/\$(\d+)/g, (_, n: string) => lit(values[Number(n) - 1]))
    return JSON.parse(psql(`SELECT coalesce(json_agg(q), '[]'::json) FROM (${bound}) q`)) as T
  },
}
const iter = <T>(xs: T[]): AsyncIterable<T> => ({
  async *[Symbol.asyncIterator]() {
    for (const x of xs) yield x
  },
})

const P = `pf${Date.now().toString(36)}`
let failures = 0
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}`}`)
  if (!ok) failures++
}

function seed() {
  psql(`
INSERT INTO "User"("id","email","referralCode","stripeAccountId") VALUES ('${P}_s','${P}s@t.t','${P}1','acct_${P}_sup'),('${P}_a','${P}a@t.t','${P}2',NULL);
INSERT INTO "Product"("id","supplierId","name","description","basePriceCents","commissionRate") VALUES ('${P}_p','${P}_s','p','d',1,1);
INSERT INTO "AffiliateProduct"("id","affiliateId","productId","sellingPriceCents") VALUES ('${P}_ap','${P}_a','${P}_p',1);
INSERT INTO "Order"("id","productId","affiliateProductId","supplierId","affiliateId","customerEmail","shippingAddress","basePriceCents","sellingPriceCents","commissionCents","marginCents","affiliatePayoutCents","stripeSessionId","stripeChargeId","updatedAt")
  VALUES ('${P}_o','${P}_p','${P}_ap','${P}_s','${P}_a','b@t.t','{}',1,1,0,0,0,'cs_${P}','ch_${P}',now());
INSERT INTO "TransferAttempt"("id","orderId","role","amountCents","destination","status","stripeTransferId") VALUES ('${P}_t','${P}_o','SUPPLIER',8736,'acct_${P}_sup','SUCCESS','tr_${P}_ok');
INSERT INTO "MerchantPayoutLedger"("id","orderId","userId","beneficiaryRole","entryType","amountCents","idempotencyKey","stripeTransferId","payoutRail") VALUES ('${P}_l','${P}_o','${P}_s','SUPPLIER','PAYOUT',8736,'${P}_k','tr_${P}_ok','connect');
INSERT INTO "OrderStripeRefund"("id","orderId","stripeRefundId","amountCents","commissionReturnedCents") VALUES ('${P}_r','${P}_o','re_${P}_1',500,0);
INSERT INTO "ProcessedWebhook"("id","status","createdAt") VALUES ('evt_${P}','success',now());`)
}
function cleanup() {
  psql(`
DELETE FROM "ProcessedWebhook" WHERE "id" LIKE 'evt_${P}%' OR "id" LIKE 'dispute:dp_${P}%';
DELETE FROM "OrderStripeRefund" WHERE "id" LIKE '${P}%';
DELETE FROM "MerchantPayoutLedger" WHERE "id" LIKE '${P}%';
DELETE FROM "TransferAttempt" WHERE "id" LIKE '${P}%';
DELETE FROM "Order" WHERE "id" LIKE '${P}%';
DELETE FROM "AffiliateProduct" WHERE "id" LIKE '${P}%';
DELETE FROM "Product" WHERE "id" LIKE '${P}%';
DELETE FROM "User" WHERE "id" LIKE '${P}%';`)
}

const now = Math.floor(Date.now() / 1000)
function stripe(o: { transfers?: unknown[]; refunds?: unknown[]; disputes?: unknown[] }): PreflightStripe {
  return {
    webhookEndpoints: {
      list: () =>
        iter([
          {
            url: "https://x/api/webhooks/stripe",
            status: "enabled",
            enabled_events: [...STRIPE_WEBHOOK_REQUIRED_EVENTS],
          },
        ]),
    },
    transfers: { list: () => iter((o.transfers ?? []) as never[]) },
    refunds: { list: () => iter((o.refunds ?? []) as never[]) },
    disputes: { list: () => iter((o.disputes ?? []) as never[]) },
    charges: { list: () => iter([{ id: `ch_${P}`, created: now - 60 }]) },
  }
}
const okTransfer = {
  id: `tr_${P}_ok`,
  amount: 8736,
  created: now,
  destination: `acct_${P}_sup`,
  transfer_group: `${P}_o`,
  metadata: { role: "SUPPLIER" },
}

async function main() {
  cleanup()
  seed()
  try {
    const status = async (s: PreflightStripe, id: string) => {
      const r = evaluatePayoutPreflight(await gatherPayoutPreflight({ stripe: s, db, keyMode: "test", sinceDays: 30 }))
      const c = r.checks.find((x) => x.id === id)!
      return {
        status: c.status,
        evidence: c.evidence,
        errors: r.checks.filter((x) => x.summary.includes("could not")).map((x) => x.evidence),
      }
    }
    let r = await status(stripe({ transfers: [okTransfer] }), "stripe_ledger_consistency")
    check("recorded transfer, same amount/destination, our account → PASS", r.status === "PASS", r)
    r = await status(stripe({ transfers: [{ ...okTransfer, id: `tr_${P}_ghost` }] }), "stripe_ledger_consistency")
    check("transfer of our order unknown to the ledger → BLOCKED", r.status === "BLOCKED", r)
    r = await status(stripe({ transfers: [{ ...okTransfer, amount: 9000 }] }), "stripe_ledger_consistency")
    check("amount differs from the ledger → BLOCKED", r.status === "BLOCKED" && r.evidence[0]!.includes("amount"), r)
    r = await status(
      stripe({ transfers: [{ ...okTransfer, destination: "acct_stranger" }] }),
      "stripe_ledger_consistency",
    )
    check("destination not ours → BLOCKED", r.status === "BLOCKED", r)
    r = await status(stripe({ transfers: [{ ...okTransfer, amount_reversed: 1000 }] }), "stripe_ledger_consistency")
    check("reversal without CLAWBACK → WARNING", r.status === "WARNING", r)
    r = await status(
      stripe({ refunds: [{ id: `re_${P}_1`, amount: 500, charge: `ch_${P}`, status: "succeeded" }] }),
      "stripe_refunds_recorded",
    )
    check("recorded refund → PASS", r.status === "PASS", r)
    r = await status(
      stripe({ refunds: [{ id: `re_${P}_2`, amount: 700, charge: `ch_${P}`, status: "succeeded" }] }),
      "stripe_refunds_recorded",
    )
    check("unrecorded refund on our charge → BLOCKED", r.status === "BLOCKED", r)
    r = await status(
      stripe({ disputes: [{ id: `dp_${P}`, status: "needs_response", charge: `ch_${P}` }] }),
      "dispute_holds",
    )
    check("open dispute without hold → BLOCKED", r.status === "BLOCKED", r)
    psql(
      `INSERT INTO "ProcessedWebhook"("id","orderId","status") VALUES ('dispute:dp_${P}:${P}_o','${P}_o','dispute_open')`,
    )
    r = await status(
      stripe({ disputes: [{ id: `dp_${P}`, status: "needs_response", charge: `ch_${P}` }] }),
      "dispute_holds",
    )
    check("open dispute with its hold → PASS", r.status === "PASS", r)
    r = await status(stripe({}), "webhook_freshness")
    check("recent webhook → PASS", r.status === "PASS", r)
    psql(`UPDATE "ProcessedWebhook" SET "createdAt" = now() - interval '5 hours' WHERE "id" = 'evt_${P}'`)
    psql(
      `UPDATE "ProcessedWebhook" SET "createdAt" = now() - interval '5 hours' WHERE "id" LIKE 'evt_%' AND "createdAt" > now() - interval '5 hours'`,
    )
    r = await status(stripe({}), "webhook_freshness")
    check("charges newer than every webhook by > 1 h → BLOCKED", r.status === "BLOCKED", r)
  } finally {
    cleanup()
  }
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
