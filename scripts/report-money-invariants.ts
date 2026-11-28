/**
 * READ-ONLY money invariants report: checks that the payout rules (#13 Lightning, #26 refunds/closed orders, #28
 * disputes) hold on what the database really recorded. Detects, never repairs.
 *
 *   DATABASE_URL='<url>' npm run report:money-invariants [-- --days 120] [--json]
 *
 * The URL is passed explicitly (.env files are never read) and the session is made server-side read-only
 * (`default_transaction_read_only=on`): a write is refused by PostgreSQL itself. Output carries order ids, codes and
 * amounts only — no personal data.
 * Exit: 0 clean · 1 medium/low only · 2 at least one critical/high · 3 usage or database error.
 */
import {
  evaluateOrderMoneyInvariants,
  moneyInvariantsExitCode,
  summarizeMoneyInvariants,
} from "../lib/finance/money-invariants"
import type { MoneyInvariantViolation } from "../lib/finance/money-invariants"
import { loadOrderMoneySnapshots } from "../lib/finance/money-invariants.server"
import { withReadOnlySession } from "./prisma-explicit-db.mjs"

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error("DATABASE_URL is not set. Pass it explicitly (this script never reads .env files).")
    return 3
  }
  const argv = process.argv.slice(2)
  const daysIdx = argv.indexOf("--days")
  const days = daysIdx >= 0 ? Number(argv[daysIdx + 1]) : 120
  if (!Number.isFinite(days) || days <= 0) {
    console.error("--days must be a positive number")
    return 3
  }
  const json = argv.includes("--json")
  const since = new Date(Date.now() - days * 86_400_000)

  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient({ datasources: { db: { url: withReadOnlySession(url) } }, log: [] })
  try {
    const violations: MoneyInvariantViolation[] = []
    let checked = 0
    let afterId: string | undefined
    for (;;) {
      const page = await loadOrderMoneySnapshots(prisma, { since, afterId, limit: 500 })
      for (const s of page.snapshots) violations.push(...evaluateOrderMoneyInvariants(s))
      checked += page.snapshots.length
      if (!page.nextAfterId) break
      afterId = page.nextAfterId
    }
    const summary = summarizeMoneyInvariants(checked, violations)
    if (json) {
      console.log(JSON.stringify({ since: since.toISOString(), summary, violations }, null, 2))
    } else {
      console.log(`[money-invariants] orders checked since ${since.toISOString().slice(0, 10)}: ${checked}`)
      console.log(`[money-invariants] violations: ${summary.violations} ${JSON.stringify(summary.bySeverity)}`)
      for (const [code, n] of Object.entries(summary.byCode)) console.log(`   ${code}: ${n}`)
      for (const v of violations.slice(0, 50)) {
        console.log(`   [${v.severity}] ${v.code} ${v.orderId}${v.role ? ` ${v.role}` : ""} — ${v.detail}`)
      }
      if (violations.length > 50) console.log(`   … ${violations.length - 50} more (use --json)`)
    }
    return moneyInvariantsExitCode(summary)
  } finally {
    await prisma.$disconnect()
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`[money-invariants] error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(3)
  },
)
