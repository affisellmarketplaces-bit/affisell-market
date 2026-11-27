/**
 * READ-ONLY: lists the Stripe transfers of the last N days (all pages) and reports every beneficiary paid more than
 * once for the same order (lib/finance/stripe-transfer-duplicates.ts). Calls `transfers.list` only — nothing is
 * created, reversed or refunded. Prints the key MODE (test / live), never a secret.
 *
 *   STRIPE_SECRET_KEY=sk_test_… npm run report:stripe-duplicates [-- --days 365] [--json]
 *
 * Exit: 0 none · 2 duplicates found · 3 usage / Stripe error.
 */
import Stripe from "stripe"

import { findStripeTransferDuplicates, type StripeTransferLite } from "../lib/finance/stripe-transfer-duplicates"

async function main(): Promise<number> {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set (pass it explicitly; .env files are not read).")
    return 3
  }
  const mode = /^(sk|rk)_test_/.test(key) ? "test" : /^(sk|rk)_live_/.test(key) ? "LIVE (read-only use)" : "unknown"
  const argv = process.argv.slice(2)
  const i = argv.indexOf("--days")
  const days = i >= 0 ? Number(argv[i + 1]) : 365
  if (!Number.isFinite(days) || days <= 0) {
    console.error("--days must be a positive number")
    return 3
  }
  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 })
  const gte = Math.floor(Date.now() / 1000) - Math.round(days * 86_400)
  const transfers: StripeTransferLite[] = []
  for await (const tr of stripe.transfers.list({ created: { gte }, limit: 100 }))
    transfers.push(tr as StripeTransferLite)
  const duplicates = findStripeTransferDuplicates(transfers)
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ mode, days, transfers: transfers.length, duplicates }, null, 2))
  } else {
    const extra = duplicates.reduce((s, d) => s + d.extraCents, 0)
    console.log(`[stripe-duplicates] key mode: ${mode} · transfers read: ${transfers.length} (last ${days} days)`)
    console.log(
      `[stripe-duplicates] beneficiaries paid more than once: ${duplicates.length} · extra: ${(extra / 100).toFixed(2)}`,
    )
    for (const d of duplicates) {
      console.log(
        `   ${d.transferGroup} → ${d.destination} ${d.role ?? "?"}: ${d.transferIds.length}× (${d.amounts.join(", ")}) extra ${d.extraCents}`,
      )
    }
  }
  return duplicates.length > 0 ? 2 : 0
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    const e = err as { type?: string; statusCode?: number; message?: string }
    console.error(
      `[stripe-duplicates] Stripe error: ${e.type ?? "error"} ${e.statusCode ?? ""} ${e.message ?? String(err)}`,
    )
    process.exit(3)
  },
)
