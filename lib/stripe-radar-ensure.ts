import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe"
import { resolveStripeRadarGlobalPriceId } from "@/lib/stripe-radar"

/** Stable Stripe lookup_key — idempotent across deploys / envs. */
export const RADAR_GLOBAL_PRICE_LOOKUP_KEY = "affisell_radar_global_monthly"

const PRODUCT_NAME = "Affisell Radar Global"
const UNIT_AMOUNT_CENTS = 9900

let cachedGlobalPriceId: string | null = null
let ensureInFlight: Promise<string | null> | null = null

function radarGlobalCurrency(): string {
  const raw = process.env.STRIPE_RADAR_GLOBAL_CURRENCY?.trim().toLowerCase()
  if (raw && /^[a-z]{3}$/.test(raw)) return raw
  return "usd"
}

/**
 * Resolve Global $99 price id: env first, then Stripe lookup_key,
 * then auto-create product+price once (Shopify-style billing bootstrap).
 */
export async function resolveOrEnsureStripeRadarGlobalPriceId(): Promise<string | null> {
  const fromEnv = resolveStripeRadarGlobalPriceId()
  if (fromEnv) {
    cachedGlobalPriceId = fromEnv
    return fromEnv
  }
  if (cachedGlobalPriceId) return cachedGlobalPriceId
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null

  if (!ensureInFlight) {
    ensureInFlight = ensureRadarGlobalPriceId()
      .then((id) => {
        cachedGlobalPriceId = id
        return id
      })
      .finally(() => {
        ensureInFlight = null
      })
  }
  return ensureInFlight
}

async function findPriceByLookupKey(stripe: Stripe): Promise<string | null> {
  const listed = await stripe.prices.list({
    lookup_keys: [RADAR_GLOBAL_PRICE_LOOKUP_KEY],
    active: true,
    limit: 1,
  })
  const id = listed.data[0]?.id
  return id ?? null
}

async function ensureRadarGlobalPriceId(): Promise<string | null> {
  try {
    const stripe = getStripeClient()
    const existing = await findPriceByLookupKey(stripe)
    if (existing) {
      console.log("[radar-paywall]", {
        result: "global_price_resolved_lookup",
        priceId: existing,
        lookupKey: RADAR_GLOBAL_PRICE_LOOKUP_KEY,
      })
      return existing
    }

    const currency = radarGlobalCurrency()
    const product = await stripe.products.create({
      name: PRODUCT_NAME,
      metadata: {
        affisell_feature: "radar_global",
        affisell_lookup: RADAR_GLOBAL_PRICE_LOOKUP_KEY,
      },
    })

    const price = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: UNIT_AMOUNT_CENTS,
      recurring: { interval: "month" },
      lookup_key: RADAR_GLOBAL_PRICE_LOOKUP_KEY,
      metadata: {
        affisell_feature: "radar_global",
        plan: "radar_global",
      },
    })

    console.log("[radar-paywall]", {
      result: "global_price_auto_provisioned",
      productId: product.id,
      priceId: price.id,
      currency,
      lookupKey: RADAR_GLOBAL_PRICE_LOOKUP_KEY,
    })
    return price.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[radar-paywall]", {
      result: "global_price_ensure_failed",
      message,
    })
    return null
  }
}

/** Test helper — clear in-memory cache between vitest cases. */
export function __resetRadarGlobalPriceCacheForTests() {
  cachedGlobalPriceId = null
  ensureInFlight = null
}
