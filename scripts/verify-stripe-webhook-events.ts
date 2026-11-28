/**
 * READ-ONLY: checks that the Stripe webhook endpoint(s) of this account receive every event the platform handles
 * (lib/stripe-webhook-required-events.ts), above all the five dispute events.
 *
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/verify-stripe-webhook-events.ts [--url-contains affisell.com]
 *
 * Only `webhookEndpoints.list` is called (all pages). Nothing is created, changed or deleted; no secret is printed —
 * only the key MODE (test / live / restricted). A restricted key needs "Webhook Endpoints: Read" only.
 * Exit: 0 every matching enabled endpoint is complete · 1 a required event is missing · 2 money-critical event missing
 *       or no matching enabled endpoint · 3 usage / Stripe error.
 */
import Stripe from "stripe"

import { checkEndpointSubscription } from "../lib/stripe-webhook-required-events"

function keyMode(key: string): string {
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test"
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "LIVE (read-only use)"
  return "unknown"
}

async function main(): Promise<number> {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set (pass it explicitly; .env files are not read).")
    return 3
  }
  const i = process.argv.indexOf("--url-contains")
  const filter = i > 0 ? (process.argv[i + 1] ?? "") : ""

  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 })
  console.log(`[stripe-webhooks] key mode: ${keyMode(key)}${filter ? ` · endpoints containing "${filter}"` : ""}`)

  const endpoints: Stripe.WebhookEndpoint[] = []
  for await (const ep of stripe.webhookEndpoints.list({ limit: 100 })) endpoints.push(ep)
  const matching = endpoints.filter((ep) => !filter || ep.url.includes(filter))
  if (matching.length === 0) {
    console.error(
      `[stripe-webhooks] FAIL no webhook endpoint${filter ? ` containing "${filter}"` : ""} (${endpoints.length} in total)`,
    )
    return 2
  }

  let worst = 0
  let enabledCount = 0
  for (const ep of matching) {
    const r = checkEndpointSubscription(ep)
    if (r.enabled) enabledCount += 1
    const state = !r.enabled
      ? "DISABLED"
      : r.missing.length === 0
        ? "OK"
        : r.missingMoneyCritical.length
          ? "FAIL"
          : "WARN"
    console.log(`[stripe-webhooks] ${state} ${r.endpoint} (api ${ep.api_version ?? "account default"})`)
    if (r.missing.length) console.log(`   missing: ${r.missing.join(", ")}`)
    if (r.enabled) worst = Math.max(worst, r.missingMoneyCritical.length ? 2 : r.missing.length ? 1 : 0)
  }
  if (enabledCount === 0) {
    console.error("[stripe-webhooks] FAIL every matching endpoint is disabled")
    return 2
  }
  return worst
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    const e = err as { type?: string; statusCode?: number; message?: string }
    console.error(
      `[stripe-webhooks] Stripe error: ${e.type ?? "error"} ${e.statusCode ?? ""} ${e.message ?? String(err)}`,
    )
    process.exit(3)
  },
)
