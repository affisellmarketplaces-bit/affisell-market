/**
 * Money invariants on a REAL PostgreSQL (local throwaway database only): seeds scenario orders, runs the exact loader
 * (`loadOrderMoneySnapshots`, same SQL as the report) and checks the evaluator's verdicts. Cleans up its own rows.
 *
 *   PGHOST=/tmp PGPORT=55432 PGUSER=postgres PGDATABASE=affi npx tsx scripts/sql/test-money-invariants.ts
 *
 * Needs every repo migration applied. Uses psql (no Prisma engine needed). Refuses any non-local host.
 */
import { execFileSync } from "node:child_process"

import { evaluateOrderMoneyInvariants } from "../../lib/finance/money-invariants"
import { loadOrderMoneySnapshots, type RawQueryable } from "../../lib/finance/money-invariants.server"

const host = process.env.PGHOST ?? ""
if (!/^(\/|localhost$|127\.0\.0\.1$)/.test(host)) {
  console.error("refused: PGHOST must be a local socket dir or localhost")
  process.exit(2)
}

function psql(sql: string): string {
  return execFileSync("psql", ["-qAtX", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim()
}

function literal(v: unknown): string {
  if (v instanceof Date) return `'${v.toISOString()}'::timestamptz`
  if (Array.isArray(v)) return `ARRAY[${v.map(literal).join(",")}]::text[]`
  if (typeof v === "number") return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

/** Runs the loader's own SQL through psql, returning rows as JSON (what Prisma's $queryRawUnsafe returns). */
const db: RawQueryable = {
  async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
    const bound = query.replace(/\$(\d+)/g, (_, n: string) => literal(values[Number(n) - 1]))
    return JSON.parse(psql(`SELECT coalesce(json_agg(q), '[]'::json) FROM (${bound}) q`)) as T
  },
}

const P = `mi${Date.now().toString(36)}`
const ago = (days: number) => `now() - interval '${days} days'`

function seed() {
  psql(`
INSERT INTO "User"("id","email","referralCode") VALUES ('${P}_sup','${P}_sup@t.test','${P}_r1'),('${P}_aff','${P}_aff@t.test','${P}_r2');
INSERT INTO "Product"("id","supplierId","name","description","basePriceCents","commissionRate") VALUES ('${P}_p','${P}_sup','p','d',7000,10);
INSERT INTO "AffiliateProduct"("id","affiliateId","productId","sellingPriceCents") VALUES ('${P}_ap','${P}_aff','${P}_p',10000);`)
  const order = (id: string, extra: { status?: string; settlement?: string; createdDaysAgo?: number } = {}) =>
    psql(`INSERT INTO "Order"("id","productId","affiliateProductId","supplierId","affiliateId","customerEmail","shippingAddress",
      "basePriceCents","sellingPriceCents","commissionCents","marginCents","affiliatePayoutCents","stripeSessionId","updatedAt",
      "totalCents","subtotalCents","status","paymentSettlementStatus","createdAt")
      VALUES ('${P}_${id}','${P}_p','${P}_ap','${P}_sup','${P}_aff','b@t.test','{}'::jsonb,7000,10000,2000,1000,2000,'cs_${P}_${id}',now(),
      10000,10000,'${extra.status ?? "delivered"}','${extra.settlement ?? "PAID"}'::"OrderPaymentSettlementStatus",${ago(extra.createdDaysAgo ?? 1)})`)
  const attempt = (o: string, role: string, amount: number, tr: string | null, status = "SUCCESS") =>
    psql(`INSERT INTO "TransferAttempt"("id","orderId","role","amountCents","destination","status","stripeTransferId")
      VALUES ('${P}_${o}_${role}','${P}_${o}','${role}'::"TransferRole",${amount},'acct_x','${status}'::"TransferStatus",${tr ? `'${tr}'` : "NULL"})`)
  let k = 0
  const ledger = (
    o: string,
    role: string,
    amount: number,
    tr: string | null,
    rail: string,
    minutesAfter = 0,
    type = "PAYOUT",
  ) =>
    psql(`INSERT INTO "MerchantPayoutLedger"("id","orderId","userId","beneficiaryRole","entryType","amountCents","idempotencyKey","stripeTransferId","payoutRail","createdAt")
      VALUES ('${P}_l${++k}','${P}_${o}','${role === "SUPPLIER" ? `${P}_sup` : `${P}_aff`}','${role}','${type}',${amount},'${P}_k${k}',${tr ? `'${tr}'` : "NULL"},'${rail}',now() + interval '${minutesAfter} minutes')`)

  // healthy: both roles paid once on Connect
  order("ok")
  attempt("ok", "SUPPLIER", 7000, `tr_${P}_1`)
  attempt("ok", "AFFILIATE", 2000, `tr_${P}_2`)
  ledger("ok", "SUPPLIER", 7000, `tr_${P}_1`, "connect")
  ledger("ok", "AFFILIATE", 2000, `tr_${P}_2`, "connect")
  // partial refund recorded, supplier paid the full share anyway (pre-#26 defect)
  order("partial", { settlement: "PARTIALLY_REFUNDED" })
  attempt("partial", "SUPPLIER", 7000, `tr_${P}_3`)
  ledger("partial", "SUPPLIER", 7000, `tr_${P}_3`, "connect")
  psql(
    `INSERT INTO "OrderStripeRefund"("id","orderId","stripeRefundId","amountCents","commissionReturnedCents") VALUES ('${P}_rf','${P}_partial','re_${P}',3000,0)`,
  )
  // paid by Lightning and by Connect (A3 race)
  order("tworails")
  attempt("tworails", "SUPPLIER", 7000, `tr_${P}_4`)
  ledger("tworails", "SUPPLIER", 7000, `tr_${P}_4`, "connect")
  ledger("tworails", "SUPPLIER", 7000, `tr_${P}_5`, "lightning", 1)
  // payout recorded after the dispute hold
  order("dispute")
  attempt("dispute", "SUPPLIER", 7000, `tr_${P}_6`)
  ledger("dispute", "SUPPLIER", 7000, `tr_${P}_6`, "connect", 30)
  psql(
    `INSERT INTO "ProcessedWebhook"("id","orderId","status","createdAt") VALUES ('dispute:dp_${P}:${P}_dispute','${P}_dispute','dispute_open',now())`,
  )
  // old order outside the window: must not be loaded
  order("old", { createdDaysAgo: 400 })
  attempt("old", "SUPPLIER", 7000, null, "PENDING")
}

function cleanup() {
  psql(`DELETE FROM "ProcessedWebhook" WHERE "orderId" LIKE '${P}_%';
DELETE FROM "OrderStripeRefund" WHERE "orderId" LIKE '${P}_%';
DELETE FROM "MerchantPayoutLedger" WHERE "orderId" LIKE '${P}_%';
DELETE FROM "TransferAttempt" WHERE "orderId" LIKE '${P}_%';
DELETE FROM "Order" WHERE "id" LIKE '${P}_%';
DELETE FROM "AffiliateProduct" WHERE "id" LIKE '${P}_%';
DELETE FROM "Product" WHERE "id" LIKE '${P}_%';
DELETE FROM "User" WHERE "id" LIKE '${P}_%';`)
}

async function main(): Promise<number> {
  seed()
  try {
    const since = new Date(Date.now() - 120 * 86_400_000)
    const found = new Map<string, string[]>()
    let afterId: string | undefined
    for (;;) {
      const page = await loadOrderMoneySnapshots(db, { since, afterId, limit: 2 }) // small pages: pagination is exercised
      for (const s of page.snapshots) {
        if (!s.orderId.startsWith(P)) continue
        found.set(
          s.orderId.slice(P.length + 1),
          evaluateOrderMoneyInvariants(s)
            .map((v) => `${v.code}${v.role ? `:${v.role}` : ""}`)
            .sort(),
        )
      }
      if (!page.nextAfterId) break
      afterId = page.nextAfterId
    }
    const expected: Record<string, string[]> = {
      ok: [],
      partial: ["paid_more_than_payable:SUPPLIER"],
      tworails: [
        "paid_more_than_payable:SUPPLIER",
        "paid_on_two_rails:SUPPLIER",
        "several_transfers_one_role:SUPPLIER",
      ],
      dispute: ["paid_after_dispute_opened:SUPPLIER"],
    }
    let failures = 0
    const check = (name: string, ok: boolean, detail: string) => {
      console.log(`${ok ? "ok  " : "FAIL"} ${name} ${detail}`)
      if (!ok) failures += 1
    }
    for (const [name, want] of Object.entries(expected)) {
      const got = found.get(name)
      check(name, JSON.stringify(got) === JSON.stringify(want), `→ ${JSON.stringify(got ?? null)}`)
    }
    check("old (outside the window)", !found.has("old"), found.has("old") ? "loaded" : "not loaded")
    return failures === 0 ? 0 : 1
  } finally {
    cleanup()
  }
}

main().then(
  (c) => process.exit(c),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(3)
  },
)
