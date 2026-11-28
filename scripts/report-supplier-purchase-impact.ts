/**
 * READ-ONLY: what the default supplier-purchase lock stops (lib/supplier-purchase/impact.ts) — live products that only
 * ship if Affisell buys them, paid orders still waiting for that purchase, queued purchase work.
 *
 *   DATABASE_URL='<url>' npm run report:supplier-purchase-impact -- [--json]
 *
 * Explicit URL only (.env files are never read), server-enforced read-only session. Run it on production BEFORE
 * deploying #35. Exit 0 · 3 error.
 */
import { IMPACT_SQL } from "../lib/supplier-purchase/impact"
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
    const products = await prisma.$queryRawUnsafe<Array<{ dependency: string; n: number }>>(
      IMPACT_SQL.liveProductsByDependency,
    )
    const [waiting] = await prisma.$queryRawUnsafe<Array<{ n: number; cents: bigint; oldest: Date | null }>>(
      IMPACT_SQL.paidOrdersWaiting,
    )
    const work = await prisma.$queryRawUnsafe<Array<{ what: string; n: number }>>(IMPACT_SQL.pendingWork)
    const out = { products, paidOrdersWaiting: { ...waiting, cents: Number(waiting?.cents ?? 0) }, pendingWork: work }
    if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2))
    else {
      console.log("[supplier-purchase-impact] live products that only ship if Affisell buys them:")
      for (const p of products) console.log(`  ${p.dependency.padEnd(32)} ${p.n}`)
      console.log(
        `[supplier-purchase-impact] paid orders (60 days) still waiting for that purchase: ${out.paidOrdersWaiting.n} (${(out.paidOrdersWaiting.cents / 100).toFixed(2)}), oldest ${waiting?.oldest ? new Date(waiting.oldest).toISOString() : "—"}`,
      )
      for (const w of work) console.log(`  queued: ${w.what.padEnd(30)} ${w.n}`)
    }
    return 0
  } finally {
    await prisma.$disconnect()
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`[supplier-purchase-impact] error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(3)
  },
)
