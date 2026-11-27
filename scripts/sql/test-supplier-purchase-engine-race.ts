/**
 * The REAL purchase code (sqlClaimStore, beginSupplierPurchase, guardSupplierPurchase with a held token,
 * executeSupplierPayment) against a REAL local PostgreSQL, with truly concurrent database sessions (one psql process
 * per simulated engine run). Proves: one claim, one wallet debit, one supplier call — under concurrent runs, a crash
 * between payment and placement, a resume, overlapping multi-order purchases, and a missing table.
 *
 *   PGHOST=/tmp PGPORT=55432 PGUSER=postgres PGDATABASE=affi npx tsx scripts/sql/test-supplier-purchase-engine-race.ts
 *
 * Local throwaway database only (refuses any other host). Cleans up its rows.
 */
import { execFileSync } from "node:child_process"

import { PsqlSession } from "./lib/psql-session"

process.env.SUPPLIER_PURCHASES_ENABLED = "true"
process.env.SUPPLIER_PURCHASE_CHANNELS = "cj,supplier_payment"

const host = process.env.PGHOST ?? ""
if (!/^(\/|localhost$|127\.0\.0\.1$)/.test(host)) {
  console.error("refused: PGHOST must be a local socket dir or localhost")
  process.exit(2)
}
const psql = (sql: string) =>
  execFileSync("psql", ["-qAtX", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}`}`)
  if (!ok) failures++
}

async function main() {
  const { sqlClaimStore, beginSupplierPurchase, guardSupplierPurchase } =
    await import("../../lib/supplier-purchase/guard.server")
  const { executeSupplierPayment } = await import("../../lib/auto-order/payment")
  const P = `ser_${Date.now().toString(36)}`
  const prov = `${P}_prov`
  const wallet = () => Number(psql(`SELECT "walletBalanceCents" FROM "FulfillmentProvider" WHERE "id" = '${prov}'`))
  const status = (k: string) =>
    psql(`SELECT coalesce(max("status"), 'none') FROM "SupplierPurchaseClaim" WHERE "id" = '${k}'`)
  psql(`INSERT INTO "FulfillmentProvider" ("id","slug","name","channelType","paymentMethod","walletBalanceCents","updatedAt")
        VALUES ('${prov}','${prov}','race test','CJ_DROPSHIPPING','WALLET_PREPAID',10000,now())`)
  const sessions: PsqlSession[] = []
  const open = () => {
    const s = new PsqlSession()
    sessions.push(s)
    return sqlClaimStore(s as never)
  }
  const group = { providerId: prov, totalCostCents: 1_000, lines: [] } as never

  /** One engine run, exactly as engine.ts sequences it, on its own database session. */
  async function engineRun(keys: string[], opts: { crashAfterPay?: boolean; supplierCalls: { n: number } }) {
    const store = open()
    const begun = await beginSupplierPurchase({ channel: "cj", path: "auto-order.engine", keys, store })
    if (begun.kind !== "claimed") return { outcome: begun.kind }
    const pay = await executeSupplierPayment({
      method: "WALLET_PREPAID",
      providerId: prov,
      batchId: "b",
      group,
      held: begun.held,
      store,
    })
    if (!pay.ok) return { outcome: `pay_failed:${pay.error}` }
    if (opts.crashAfterPay) return { outcome: "crashed_after_pay", held: begun.held }
    const placed = await guardSupplierPurchase(
      { channel: "cj", path: "cj-dropshipping.placeOrder", keys, heldToken: begun.held.token, store },
      async () => {
        opts.supplierCalls.n += 1
        await sleep(50)
        return { kind: "placed", supplierOrderId: `cj_${P}`, value: null }
      },
    )
    return { outcome: placed.kind }
  }

  try {
    // 1. Eight concurrent engine runs for the same two orders.
    {
      const keys = [`order:${P}_o1`, `order:${P}_o2`]
      const calls = { n: 0 }
      const before = wallet()
      const rs = await Promise.all(Array.from({ length: 8 }, () => engineRun(keys, { supplierCalls: calls })))
      check(
        "8 concurrent runs → 1 sent, 7 refused",
        rs.filter((r) => r.outcome === "sent").length === 1 &&
          rs.filter((r) => r.outcome === "in_flight_or_uncertain").length === 7,
        rs.map((r) => r.outcome),
      )
      check("…exactly one wallet debit", wallet() === before - 1_000, [before, wallet()])
      check("…exactly one supplier call", calls.n === 1, calls.n)
      check("…claim placed", status(keys[0]!) === "placed" && status(keys[1]!) === "placed")
      const replay = await engineRun(keys, { supplierCalls: calls })
      check(
        "a later re-run of the batch: already placed, nothing paid",
        replay.outcome === "already_placed" && wallet() === before - 1_000,
      )
    }

    // 2. Crash after the debit, then concurrent re-runs and a resume of the crashed claim.
    {
      const keys = [`order:${P}_crash`]
      const calls = { n: 0 }
      const before = wallet()
      const crashed = await engineRun(keys, { crashAfterPay: true, supplierCalls: calls })
      check("crashed run paid once", crashed.outcome === "crashed_after_pay" && wallet() === before - 1_000)
      const reruns = await Promise.all([1, 2, 3].map(() => engineRun(keys, { supplierCalls: calls })))
      check(
        "re-runs after the crash are refused",
        reruns.every((r) => r.outcome === "in_flight_or_uncertain"),
        reruns,
      )
      const store = open()
      const resumed = await Promise.all(
        [1, 2, 3].map(() =>
          executeSupplierPayment({
            method: "WALLET_PREPAID",
            providerId: prov,
            batchId: "b",
            group,
            held: crashed.held!,
            store: open(),
          }),
        ),
      )
      check(
        "3 concurrent resumes of the crashed claim debit nothing",
        resumed.every((r) => !r.ok) && wallet() === before - 1_000,
      )
      const rows = await store.readAll(keys)
      check(
        "the claim shows 'claimed, paid' for reconciliation",
        rows[0]?.status === "claimed" && rows[0]?.paidCents === 1_000,
        rows,
      )
      check("no supplier call was made for it", calls.n === 0)
    }

    // 3. Overlapping multi-order purchases. The conflicting key is sorted AFTER each run's own key, so a run claims its
    //    own key first and then hits the conflict: that first claim must be rolled back (nothing half-claimed).
    {
      const [a, a2, b] = ["a", "a2", "b"].map((x) => `order:${P}_seq${x}`)
      const calls = { n: 0 }
      const first = await engineRun([a!, b!], { supplierCalls: calls })
      const second = await engineRun([a2!, b!], { supplierCalls: calls })
      check(
        "sequential overlap: the second purchase is refused and its own key is NOT left claimed",
        first.outcome === "sent" && second.outcome === "in_flight_or_uncertain" && status(a2!) === "none",
        [first, second, status(a2!)],
      )
    }
    for (let round = 0; round < 3; round++) {
      const [a, a2, b] = ["a", "a2", "b"].map((x) => `order:${P}_ov${round}${x}`)
      const calls = { n: 0 }
      const [r1, r2] = await Promise.all([
        engineRun([a!, b!], { supplierCalls: calls }),
        engineRun([a2!, b!], { supplierCalls: calls }),
      ])
      const sent = [r1, r2].filter((r) => r.outcome === "sent").length
      const loserOwnKey = r1.outcome === "sent" ? status(a2!) : status(a!)
      check(
        `concurrent overlap round ${round}: one purchase, the loser left nothing claimed`,
        sent === 1 && calls.n === 1 && loserOwnKey === "none",
        [r1, r2, loserOwnKey],
      )
    }

    // 4. Table missing (migration not applied): refused, nothing sent, nothing paid.
    {
      psql(`ALTER TABLE "SupplierPurchaseClaim" RENAME TO "SupplierPurchaseClaim_hidden"`)
      try {
        const calls = { n: 0 }
        const before = wallet()
        const r = await engineRun([`order:${P}_nomig`], { supplierCalls: calls })
        check(
          "table missing → refused, no payment, no supplier call",
          r.outcome === "claim_store_unavailable" && calls.n === 0 && wallet() === before,
          r,
        )
      } finally {
        psql(`ALTER TABLE "SupplierPurchaseClaim_hidden" RENAME TO "SupplierPurchaseClaim"`)
      }
    }
  } finally {
    await Promise.all(sessions.map((s) => s.close()))
    psql(`DELETE FROM "SupplierPurchaseClaim" WHERE "id" LIKE 'order:${P}%'`)
    psql(`DELETE FROM "FulfillmentProvider" WHERE "id" = '${prov}'`)
  }
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
