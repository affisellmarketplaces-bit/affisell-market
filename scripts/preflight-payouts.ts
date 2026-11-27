/**
 * READ-ONLY payout preflight: PASS · WARNING · BLOCKED before a payout cycle (lib/finance/payout-preflight.ts).
 *
 *   STRIPE_SECRET_KEY=sk_test_… DATABASE_URL='<url>' npm run preflight:payouts -- [--days 120] [--webhook-url affisell] [--json]
 *
 * Stripe: webhookEndpoints.list + transfers.list only. Database: SELECT only, in a server-enforced read-only session
 * (default_transaction_read_only=on). Both values are passed explicitly (.env files are never read); no secret is
 * printed — only the key mode. Not wired to any payout path: it reports, it does not stop anything by itself.
 * Exit: 0 PASS · 1 WARNING · 2 BLOCKED · 3 usage error.
 */
import Stripe from "stripe"

import { evaluatePayoutPreflight, preflightExitCode } from "../lib/finance/payout-preflight"
import { gatherPayoutPreflight, stripeKeyMode, type PreflightStripe } from "../lib/finance/payout-preflight.server"
import { withReadOnlySession } from "./prisma-explicit-db.mjs"

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const arg = (name: string) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const days = Number(arg("--days") ?? 120)
  if (!Number.isFinite(days) || days <= 0) {
    console.error("--days must be a positive number")
    return 3
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim() || null
  const url = process.env.DATABASE_URL?.trim() || null

  const stripe = key ? (new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 }) as unknown as PreflightStripe) : null
  let prisma: { $disconnect(): Promise<void> } | null = null
  let db = null
  if (url) {
    const { PrismaClient } = await import("@prisma/client")
    const client = new PrismaClient({ datasources: { db: { url: withReadOnlySession(url) } }, log: [] })
    prisma = client
    db = client
  }
  try {
    const input = await gatherPayoutPreflight({
      stripe,
      db,
      keyMode: stripeKeyMode(key),
      sinceDays: days,
      webhookUrlContains: arg("--webhook-url"),
    })
    const result = evaluatePayoutPreflight(input)
    if (argv.includes("--json")) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`[preflight:payouts] verdict: ${result.verdict} (window ${days} days)`)
      for (const c of result.checks) {
        console.log(` ${c.status.padEnd(7)} ${c.id} — ${c.summary}`)
        for (const e of c.evidence) console.log(`          · ${e}`)
        if (c.recommendation) console.log(`          → ${c.recommendation}`)
      }
    }
    return preflightExitCode(result)
  } finally {
    await prisma?.$disconnect()
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`[preflight:payouts] error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(3)
  },
)
