/**
 * Supplier purchase claim on a REAL PostgreSQL (local throwaway database only): runs the guard's exact SQL
 * (SUPPLIER_PURCHASE_CLAIM_SQL) through psql, including two concurrent sessions racing for the same key.
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
      : `'${String(v).replace(/'/g, "''")}'`
const bind = (q: string, ...v: unknown[]) => q.replace(/\$(\d+)/g, (_, n: string) => lit(v[Number(n) - 1]))
const claimSql = (key: string) => bind(SQL.tryClaim, key, "aliexpress", "sql-test")
const claim = (key: string): number => Number(psql(`WITH q AS (${claimSql(key)}) SELECT count(*) FROM q`))
const settle = (key: string, status: string, id: string | null) => psql(bind(SQL.settleAll, [key], status, id, null))
const status = (key: string) =>
  psql(`SELECT "status" || '/' || "attempts" FROM "SupplierPurchaseClaim" WHERE "id" = ${lit(key)}`)

const P = `spc_${Date.now().toString(36)}`
let failures = 0
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}`}`)
  if (!ok) failures++
}

function session(sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("psql", ["-qAtX", "-v", "ON_ERROR_STOP=1", "-c", sql])
    let out = ""
    p.stdout.on("data", (d) => (out += d))
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`psql exit ${code}`))))
  })
}

async function main() {
  try {
    // 1. first claim wins, second (sequential) refused
    check("first claim", claim(`${P}:a`) === 1)
    check("second claim refused while claimed", claim(`${P}:a`) === 0)
    // 2. placed → refused; settle only from claimed
    settle(`${P}:a`, "placed", "ae_1")
    check("placed is final", claim(`${P}:a`) === 0 && status(`${P}:a`) === "placed/1", status(`${P}:a`))
    settle(`${P}:a`, "rejected", null) // must NOT downgrade a placed row
    check("settle cannot rewrite a placed row", status(`${P}:a`) === "placed/1", status(`${P}:a`))
    // 3. rejected → re-claimable, attempts counted
    claim(`${P}:b`)
    settle(`${P}:b`, "rejected", null)
    check("rejected re-claimable", claim(`${P}:b`) === 1 && status(`${P}:b`) === "claimed/2", status(`${P}:b`))
    // 4. uncertain → refused
    settle(`${P}:b`, "uncertain", null)
    check("uncertain refused", claim(`${P}:b`) === 0)
    // 5. CHECK constraints
    let refused = false
    try {
      psql(
        `INSERT INTO "SupplierPurchaseClaim" ("id","channel","path","status") VALUES (${lit(`${P}:c`)},'x','y','placed')`,
      )
    } catch {
      refused = true
    }
    check("placed without supplier order id refused by the database", refused)
    refused = false
    try {
      psql(
        `INSERT INTO "SupplierPurchaseClaim" ("id","channel","path","status") VALUES (${lit(`${P}:d`)},'x','y','done')`,
      )
    } catch {
      refused = true
    }
    check("unknown status refused by the database", refused)
    // 6. two concurrent sessions, same key: exactly one wins
    for (let round = 0; round < 5; round++) {
      const key = `${P}:race${round}`
      const hold = `BEGIN; WITH q AS (${claimSql(key)}) SELECT count(*) FROM q; SELECT pg_sleep(0.6); COMMIT;`
      const a = session(hold)
      await new Promise((r) => setTimeout(r, 150))
      const b = session(`WITH q AS (${claimSql(key)}) SELECT count(*) FROM q`)
      const [ra, rb] = await Promise.all([a, b])
      const wins = [ra.split("\n")[0], rb].map(Number).reduce((s, n) => s + n, 0)
      check(`concurrent sessions round ${round}: one winner`, wins === 1, [ra, rb])
    }
    // 7. rejected re-claim racing: still one winner
    claim(`${P}:rr`)
    settle(`${P}:rr`, "rejected", null)
    const rs = await Promise.all(
      [1, 2, 3].map(() => session(`WITH q AS (${claimSql(`${P}:rr`)}) SELECT count(*) FROM q`)),
    )
    check("3 concurrent re-claims of a rejected key: one winner", rs.map(Number).reduce((s, n) => s + n, 0) === 1, rs)
  } finally {
    psql(`DELETE FROM "SupplierPurchaseClaim" WHERE "id" LIKE ${lit(`${P}:%`)}`)
  }
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
