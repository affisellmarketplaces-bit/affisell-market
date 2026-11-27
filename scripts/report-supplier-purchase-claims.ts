/**
 * READ-ONLY: supplier-purchase claims that need a human (uncertain, stuck, paid-not-placed) — lib/supplier-purchase/reconcile.ts.
 *
 *   DATABASE_URL='<url>' npm run report:supplier-purchase-claims -- [--json]
 *
 * Explicit URL only (.env files are never read), server-enforced read-only session. Exit 0 nothing to do · 2 claims
 * need a decision · 3 error. Resolve each with `npm run resolve:supplier-purchase-claim` (dry-run by default).
 */
import { ANOMALY_SQL, classifyClaim, type ClaimForReconcile } from "../lib/supplier-purchase/reconcile"
import { withReadOnlySession } from "./prisma-explicit-db.mjs"

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error("DATABASE_URL is not set. Pass it explicitly (this script never reads .env files).")
    return 3
  }
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient({ datasources: { db: { url: withReadOnlySession(url) } }, log: [] })
  try {
    const rows = await prisma.$queryRawUnsafe<ClaimForReconcile[]>(ANOMALY_SQL)
    const anomalies = rows.map((r) => classifyClaim(r)).filter((a) => a !== null)
    if (process.argv.includes("--json")) console.log(JSON.stringify({ open: rows.length, anomalies }, null, 2))
    else {
      console.log(`[supplier-purchase-claims] open claims: ${rows.length}, needing a decision: ${anomalies.length}`)
      for (const a of anomalies) console.log(` ${a.kind.padEnd(18)} ${a.id} — ${a.detail}\n   → ${a.action}`)
    }
    return anomalies.length > 0 ? 2 : 0
  } finally {
    await prisma.$disconnect()
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`[supplier-purchase-claims] error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(3)
  },
)
