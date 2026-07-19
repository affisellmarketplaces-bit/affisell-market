import type Stripe from "stripe"

import type { RadarCheckoutPlanId } from "@/lib/radar/plans"
import { getStripeClient } from "@/lib/stripe"
import {
  resolveStripeRadarGlobalPriceId,
} from "@/lib/stripe-radar"

/** Stable Stripe lookup_keys — idempotent across deploys / Stripe accounts. */
export const RADAR_PRO_PRICE_LOOKUP_KEY = "affisell_radar_pro_monthly"
export const RADAR_GLOBAL_PRICE_LOOKUP_KEY = "affisell_radar_global_monthly"

type RadarPriceSpec = {
  plan: RadarCheckoutPlanId
  lookupKey: string
  productName: string
  unitAmountCents: number
  featureMeta: string
}

const SPECS: Record<RadarCheckoutPlanId, RadarPriceSpec> = {
  pro: {
    plan: "pro",
    lookupKey: RADAR_PRO_PRICE_LOOKUP_KEY,
    productName: "Affisell Radar Pro",
    unitAmountCents: 4900,
    featureMeta: "radar_pro",
  },
  global: {
    plan: "global",
    lookupKey: RADAR_GLOBAL_PRICE_LOOKUP_KEY,
    productName: "Affisell Radar Global",
    unitAmountCents: 9900,
    featureMeta: "radar_global",
  },
}

const cache: Partial<Record<RadarCheckoutPlanId, string | null>> = {}
const inFlight: Partial<Record<RadarCheckoutPlanId, Promise<string | null>>> = {}

function radarCurrency(plan: RadarCheckoutPlanId): string {
  const key =
    plan === "global" ? "STRIPE_RADAR_GLOBAL_CURRENCY" : "STRIPE_RADAR_PRO_CURRENCY"
  const raw = process.env[key]?.trim().toLowerCase()
  if (raw && /^[a-z]{3}$/.test(raw)) return raw
  return "usd"
}

function envCandidates(plan: RadarCheckoutPlanId): string[] {
  if (plan === "global") {
    const id = resolveStripeRadarGlobalPriceId()
    return id ? [id] : []
  }
  // Prefer dedicated Radar Pro; video STRIPE_PRO_PRICE_ID is a soft fallback
  // that often points at a deleted / wrong-account price → validated below.
  const out: string[] = []
  const radar = process.env.STRIPE_RADAR_PRO_PRICE_ID?.trim()
  if (radar) out.push(radar)
  const videoPro = process.env.STRIPE_PRO_PRICE_ID?.trim()
  if (videoPro && videoPro !== radar) out.push(videoPro)
  return out
}

async function priceExistsInStripe(stripe: Stripe, priceId: string): Promise<boolean> {
  try {
    const price = await stripe.prices.retrieve(priceId)
    return Boolean(price?.id) && price.active !== false
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const missing = /No such price|resource_missing/i.test(message)
    if (missing) {
      console.warn("[radar-paywall]", {
        result: "stale_price_ignored",
        priceId,
        message,
      })
      return false
    }
    throw err
  }
}

async function findPriceByLookupKey(stripe: Stripe, lookupKey: string): Promise<string | null> {
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  })
  return listed.data[0]?.id ?? null
}

async function ensurePriceForPlan(plan: RadarCheckoutPlanId): Promise<string | null> {
  const spec = SPECS[plan]
  try {
    const stripe = getStripeClient()

    for (const candidate of envCandidates(plan)) {
      if (await priceExistsInStripe(stripe, candidate)) {
        console.log("[radar-paywall]", {
          result: `${plan}_price_resolved_env`,
          priceId: candidate,
        })
        return candidate
      }
    }

    const existing = await findPriceByLookupKey(stripe, spec.lookupKey)
    if (existing) {
      console.log("[radar-paywall]", {
        result: `${plan}_price_resolved_lookup`,
        priceId: existing,
        lookupKey: spec.lookupKey,
      })
      return existing
    }

    const currency = radarCurrency(plan)
    const product = await stripe.products.create({
      name: spec.productName,
      metadata: {
        affisell_feature: spec.featureMeta,
        affisell_lookup: spec.lookupKey,
      },
    })

    const price = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: spec.unitAmountCents,
      recurring: { interval: "month" },
      lookup_key: spec.lookupKey,
      metadata: {
        affisell_feature: spec.featureMeta,
        plan: spec.featureMeta,
      },
    })

    console.log("[radar-paywall]", {
      result: `${plan}_price_auto_provisioned`,
      productId: product.id,
      priceId: price.id,
      currency,
      lookupKey: spec.lookupKey,
    })
    return price.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[radar-paywall]", {
      result: `${plan}_price_ensure_failed`,
      message,
    })
    return null
  }
}

/**
 * Resolve Radar Stripe price: validate env IDs (heal stale), then lookup_key,
 * then auto-create once. Survives wrong-account / deleted STRIPE_PRO_PRICE_ID.
 */
export async function resolveOrEnsureStripeRadarPriceId(
  plan: RadarCheckoutPlanId
): Promise<string | null> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null

  const cached = cache[plan]
  if (cached) return cached

  if (!inFlight[plan]) {
    inFlight[plan] = ensurePriceForPlan(plan)
      .then((id) => {
        cache[plan] = id
        return id
      })
      .finally(() => {
        delete inFlight[plan]
      })
  }
  return inFlight[plan]!
}

export async function resolveOrEnsureStripeRadarGlobalPriceId(): Promise<string | null> {
  return resolveOrEnsureStripeRadarPriceId("global")
}

export async function resolveOrEnsureStripeRadarProPriceId(): Promise<string | null> {
  return resolveOrEnsureStripeRadarPriceId("pro")
}

/** @deprecated use resolveOrEnsureStripeRadarPriceId — kept for callers/tests */
export function __resetRadarGlobalPriceCacheForTests() {
  delete cache.global
  delete cache.pro
  delete inFlight.global
  delete inFlight.pro
}

export function __resetRadarPriceCacheForTests() {
  __resetRadarGlobalPriceCacheForTests()
}
