/**
 * Supplier purchase claim + wallet debit on a REAL PostgreSQL (local throwaway database only): runs the guard's exact
 * SQL (SUPPLIER_PURCHASE_CLAIM_SQL) through psql, with REAL concurrent sessions — claim races, wallet-debit races on
 * the same claim and on the same wallet, a session killed mid-transaction, and the database constraints.
 *
 *   PGHOST=/tmp PGPORT=55432 PGUSER=postgres PGDATABASE=affi npx tsx scripts/sql/test-supplier-purchase-claim.ts
 *
 * Needs the 20261127120000_supplier_purchase_claim migration applied. Refuses any non-local host. Cleans up its rows.
 */
import { execFileSync, spawn } from "node:child_process"

import { SUPPLIER_PURCHASE_CLAIM_SQL as SQL } from "../../lib/supplier-purchase/guard.server"

const host = process.env.PGHOST ?? ""
if (!/^(\/|localhost$|127\.0\.0\.1$)/.test(host)) {
  console.error("refused: PGHOST must be a local socket dir or localhost")
  process.exit(2)
}

const psql = (sql: string) =>
  execFileSync("psql", ["-qAtX", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim()
const lit = (v: unknown): string =>
  v === null
    ? "NULL"
    : Array.isArray(v)
      ? `ARRAY[${v.map(lit).join(",")}]::text[]`
      : typeof v === "number"
        ? String(v)
        : `'${String(v).replace(/'/g, "''")}'`
const bind = (q: string, ...v: unknown[]) => q.replace(/\$(\d+)/g, (_, n: string) => lit(v[Number(n) - 1]))
const claimSql = (key: string, token: string) => bind(SQL.tryClaim, key, "cj", "sql-test", token)
const claim = (key: string, token: string): number =>
  Number(psql(`WITH q AS (${claimSql(key, token)}) SELECT count(*) FROM q`))
const settle = (keys: string[], token: string, status: string, id: string | null) =>
  psql(bind(SQL.settleAll, keys, token, status, id, null))
const row = (key: string) =>
  psql(
    `SELECT "status" || '/' || "attempts" || '/' || coalesce("paidCents"::text, '-') FROM "SupplierPurchaseClaim" WHERE "id" = ${lit(key)}`,
  )
const wallet = (p: string) =>
  Number(psql(`SELECT "walletBalanceCents" FROM "FulfillmentProvider" WHERE "id" = ${lit(p)}`))

/** The guard's debitWalletForClaim as ONE psql transaction: stamp the claim, then debit; any 0-row step aborts. */
const debitTx = (keys: string[], token: string, provider: string, cents: number, holdSeconds = 0) => `
BEGIN;
CREATE TEMP TABLE r(step text, n int) ON COMMIT DROP;
WITH s AS (${bind(SQL.walletStamp, keys, token, cents, provider)} RETURNING 1) INSERT INTO r SELECT 'stamp', count(*) FROM s;
DO $$ BEGIN IF (SELECT n FROM r WHERE step = 'stamp') <> ${keys.length} THEN RAISE EXCEPTION 'already_paid_or_not_held'; END IF; END $$;
${holdSeconds ? `SELECT pg_sleep(${holdSeconds});` : ""}
WITH d AS (${bind(SQL.walletDebit, provider, cents)} RETURNING 1) INSERT INTO r SELECT 'debit', count(*) FROM d;
DO $$ BEGIN IF (SELECT n FROM r WHERE step = 'debit') <> 1 THEN RAISE EXCEPTION 'insufficient_wallet_balance'; END IF; END $$;
COMMIT;`

/**
 * The guard's quota claim (sqlClaimStore.tryClaimAll with a dailyLimit) as ONE psql transaction, with a pause between
 * the count and the insert — exactly the window two concurrent purchases race in. `lock=false` is the control: the
 * same transaction without the per-channel lock, which must overshoot (proves the test can see the race at all).
 */
const quotaTx = (key: string, token: string, channel: string, limit: number, lock: boolean) => `
BEGIN;
${lock ? `${bind(SQL.quotaLock, channel)};` : ""}
DO $$ BEGIN IF (${bind(SQL.quotaBlockedKeys, [key]).replace('count(*)::int AS "n"', "count(*)")}) > 0 THEN RAISE EXCEPTION 'conflict'; END IF; END $$;
DO $$ BEGIN IF (${bind(SQL.quotaCount, channel).replace('count(DISTINCT "token")::int AS "n"', 'count(DISTINCT "token")')}) >= ${limit} THEN RAISE EXCEPTION 'daily_limit_reached'; END IF; END $$;
SELECT pg_sleep(0.4);
${bind(SQL.tryClaim, key, channel, "sql-quota", token)};
COMMIT;`

function session(sql: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const p = spawn("psql", ["-qAtX", "-v", "ON_ERROR_STOP=1", "-c", sql])
    let out = ""
    p.stdout.on("data", (d) => (out += d))
    p.stderr.on("data", (d) => (out += d))
    p.on("close", (code) => resolve({ ok: code === 0, out: out.trim() }))
  })
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const P = `spc_${Date.now().toString(36)}`
let failures = 0
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}`}`)
  if (!ok) failures++
}
const provider = `${P}_prov`

async function main() {
  psql(
    `INSERT INTO "FulfillmentProvider" ("id","slug","name","channelType","paymentMethod","walletBalanceCents","updatedAt")
     VALUES (${lit(provider)}, ${lit(provider)}, 'sql test', 'CJ_DROPSHIPPING', 'WALLET_PREPAID', 5000, now())`,
  )
  try {
    // 1. claim basics
    check("first claim", claim(`${P}:a`, "t1") === 1)
    check("second claim refused while claimed", claim(`${P}:a`, "t2") === 0)
    settle([`${P}:a`], "wrong-token", "placed", "x")
    check("settle with a wrong token changes nothing", row(`${P}:a`) === "claimed/1/-", row(`${P}:a`))
    settle([`${P}:a`], "t1", "placed", "ae_1")
    check("placed is final", claim(`${P}:a`, "t3") === 0 && row(`${P}:a`) === "placed/1/-", row(`${P}:a`))
    // 2. rejected unpaid → re-claimable with a NEW token
    claim(`${P}:b`, "t1")
    settle([`${P}:b`], "t1", "rejected", null)
    check(
      "unpaid rejected is re-claimable",
      claim(`${P}:b`, "t9") === 1 && row(`${P}:b`) === "claimed/2/-",
      row(`${P}:b`),
    )
    check(
      "the re-claim carries the new token",
      psql(`SELECT "token" FROM "SupplierPurchaseClaim" WHERE "id" = ${lit(`${P}:b`)}`) === "t9",
    )

    // 3. wallet debit under a held claim: once, and only once
    const K = [`${P}:w1`, `${P}:w2`]
    for (const k of K) claim(k, "tw")
    check(
      "debit under the held claim",
      (await session(debitTx(K, "tw", provider, 1000))).ok && wallet(provider) === 4000,
    )
    const again = await session(debitTx(K, "tw", provider, 1000))
    check(
      "a second debit for the same claim is refused (resume / retry)",
      !again.ok && again.out.includes("already_paid_or_not_held") && wallet(provider) === 4000,
      again.out,
    )
    check(
      "a forged token cannot debit",
      !(await session(debitTx(K, "forged", provider, 1000))).ok && wallet(provider) === 4000,
    )
    settle(K, "tw", "rejected", null)
    check("supplier refusal after payment is stored uncertain", row(`${P}:w1`) === "uncertain/1/1000", row(`${P}:w1`))
    check("…and the paid claim cannot be claimed again", claim(`${P}:w1`, "tz") === 0)

    // 4. RACE: five concurrent debits of the SAME claim → exactly one debit
    for (let round = 0; round < 3; round++) {
      const keys = [`${P}:race${round}`]
      claim(keys[0]!, `tr${round}`)
      const before = wallet(provider)
      const rs = await Promise.all([1, 2, 3, 4, 5].map(() => session(debitTx(keys, `tr${round}`, provider, 100, 0.2))))
      check(
        `round ${round}: 5 concurrent debits of one claim → 1 debit`,
        rs.filter((r) => r.ok).length === 1 && wallet(provider) === before - 100,
        rs.map((r) => r.ok),
      )
    }

    // 5. RACE: two DIFFERENT purchases on one wallet that covers only one → exactly one debit, never negative
    psql(`UPDATE "FulfillmentProvider" SET "walletBalanceCents" = 700 WHERE "id" = ${lit(provider)}`)
    claim(`${P}:x`, "tx")
    claim(`${P}:y`, "ty")
    const [rx, ry] = await Promise.all([
      session(debitTx([`${P}:x`], "tx", provider, 600, 0.2)),
      session(debitTx([`${P}:y`], "ty", provider, 600, 0.2)),
    ])
    check(
      "two purchases, money for one: one debit, balance never negative",
      [rx.ok, ry.ok].filter(Boolean).length === 1 && wallet(provider) === 100,
      [rx.out, ry.out, wallet(provider)],
    )
    const loser = rx.ok ? `${P}:y` : `${P}:x`
    check("the losing claim stays unpaid (its stamp rolled back)", row(loser) === "claimed/1/-", row(loser))

    // 6. CRASH: a session killed after the stamp, before commit → neither stamp nor debit survives
    psql(`UPDATE "FulfillmentProvider" SET "walletBalanceCents" = 5000 WHERE "id" = ${lit(provider)}`)
    claim(`${P}:crash`, "tc")
    const victim = session(debitTx([`${P}:crash`], "tc", provider, 900, 5))
    await sleep(700)
    psql(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%pg_sleep(5)%' AND pid <> pg_backend_pid()`,
    )
    await victim
    check(
      "killed mid-transaction: no stamp, no debit",
      row(`${P}:crash`) === "claimed/1/-" && wallet(provider) === 5000,
      [row(`${P}:crash`), wallet(provider)],
    )

    // 7. RACE: concurrent claims of the same key (two engine runs)
    for (let round = 0; round < 3; round++) {
      const key = `${P}:claimrace${round}`
      const hold = `BEGIN; WITH q AS (${claimSql(key, "ta")}) SELECT count(*) FROM q; SELECT pg_sleep(0.5); COMMIT;`
      const a = session(hold)
      await sleep(150)
      const b = session(`WITH q AS (${claimSql(key, "tb")}) SELECT count(*) FROM q`)
      const [ra, rb] = await Promise.all([a, b])
      const wins = Number(ra.out.split("\n")[0]) + Number(rb.out)
      check(`claim race round ${round}: one winner`, wins === 1, [ra.out, rb.out])
    }

    // 7b. RACE on the daily quota: 4 concurrent new purchases, limit 1, each pausing between count and insert
    for (const lock of [true, false]) {
      const ch = `${P}_q${lock ? "L" : "N"}`
      const rs = await Promise.all(
        [0, 1, 2, 3].map((i) => session(quotaTx(`${P}:q${lock}${i}`, `tq${lock}${i}`, ch, 1, lock))),
      )
      const committed = Number(psql(`SELECT count(*) FROM "SupplierPurchaseClaim" WHERE "channel" = ${lit(ch)}`))
      if (lock)
        check(
          "quota race, with the per-channel lock: limit 1 → exactly 1 purchase claimed",
          committed === 1 && rs.filter((r) => r.ok).length === 1,
          rs,
        )
      else check("control, WITHOUT the lock: the same race overshoots (the test can see it)", committed > 1, committed)
      psql(`DELETE FROM "SupplierPurchaseClaim" WHERE "channel" = ${lit(ch)}`)
    }

    // 7c. a supplier refusal does not consume the quota (limit 1, one rejected claim → a new purchase is still allowed)
    {
      const ch = `${P}_qR`
      psql(bind(SQL.tryClaim, `${P}:qr0`, ch, "sql-quota", "tqr0"))
      settle([`${P}:qr0`], "tqr0", "rejected", null)
      const r = await session(quotaTx(`${P}:qr1`, "tqr1", ch, 1, true))
      check("quota: a rejected claim does not count, a new purchase is allowed", r.ok, r)
      psql(`DELETE FROM "SupplierPurchaseClaim" WHERE "channel" = ${lit(ch)}`)
    }

    // 8. database constraints (defence in depth, whatever the code does)
    for (const [name, sql] of [
      ["placed without a supplier order id", `('${P}:c1','x','y','placed',NULL,'t',NULL)`],
      ["unknown status", `('${P}:c2','x','y','done',NULL,'t',NULL)`],
      ["claimed without a token", `('${P}:c3','x','y','claimed',NULL,NULL,NULL)`],
      ["paid AND rejected", `('${P}:c4','x','y','rejected',NULL,'t',500)`],
      ["negative payment", `('${P}:c5','x','y','uncertain',NULL,'t',-1)`],
    ] as const) {
      let refused = false
      try {
        psql(
          `INSERT INTO "SupplierPurchaseClaim" ("id","channel","path","status","supplierOrderId","token","paidCents") VALUES ${sql}`,
        )
      } catch {
        refused = true
      }
      check(`database refuses: ${name}`, refused)
    }
  } finally {
    psql(`DELETE FROM "SupplierPurchaseClaim" WHERE "id" LIKE ${lit(`${P}:%`)}`)
    psql(`DELETE FROM "FulfillmentProvider" WHERE "id" = ${lit(provider)}`)
  }
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
