import type Stripe from "stripe"

import { GROWTH_PRICING_TIERS, type GrowthPricingTierId } from "@/lib/growth-pricing-tiers"
import { getStripeClient } from "@/lib/stripe"
import type { GrowthBillingInterval } from "@/lib/stripe-growth-shared"

export type { GrowthBillingInterval }

type GrowthSpecKey = `${GrowthPricingTierId}_${GrowthBillingInterval}`

type GrowthPriceSpec = {
  plan: GrowthPricingTierId
  interval: GrowthBillingInterval
  lookupKey: string
  envVar: string
  productName: string
  unitAmountCents: number
  featureMeta: string
}

function specKey(plan: GrowthPricingTierId, interval: GrowthBillingInterval): GrowthSpecKey {
  return `${plan}_${interval}`
}

function envVarForPlan(plan: GrowthPricingTierId, interval: GrowthBillingInterval): string {
  return `STRIPE_GROWTH_${plan.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`
}

const SPECS: Record<GrowthSpecKey, GrowthPriceSpec> = Object.fromEntries(
  (["lanceur", "dominator", "empire"] as const).flatMap((plan) =>
    (["monthly", "annual"] as const).map((interval) => {
      const tier = GROWTH_PRICING_TIERS[plan]
      const spec: GrowthPriceSpec = {
        plan,
        interval,
        lookupKey: `affisell_growth_${plan}_${interval}`,
        envVar: envVarForPlan(plan, interval),
        productName: `Affisell Growth ${tier.name}${interval === "annual" ? " (annuel)" : ""}`,
        unitAmountCents: Math.round((interval === "annual" ? tier.annual : tier.monthly) * 100),
        featureMeta: `growth_${plan}`,
      }
      return [specKey(plan, interval), spec]
    })
  )
) as Record<GrowthSpecKey, GrowthPriceSpec>

const cache: Partial<Record<GrowthSpecKey, string | null>> = {}
const inFlight: Partial<Record<GrowthSpecKey, Promise<string | null>>> = {}

function growthCurrency(): string {
  const raw = process.env.STRIPE_GROWTH_CURRENCY?.trim().toLowerCase()
  if (raw && /^[a-z]{3}$/.test(raw)) return raw
  return "eur"
}

async function priceExistsInStripe(stripe: Stripe, priceId: string): Promise<boolean> {
  try {
    const price = await stripe.prices.retrieve(priceId)
    return Boolean(price?.id) && price.active !== false
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const missing = /No such price|resource_missing/i.test(message)
    if (missing) {
      console.warn("[growth-paywall]", { result: "stale_price_ignored", priceId, message })
      return false
    }
    throw err
  }
}

async function findPriceByLookupKey(stripe: Stripe, lookupKey: string): Promise<string | null> {
  const listed = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  return listed.data[0]?.id ?? null
}

async function ensurePriceForSpec(key: GrowthSpecKey): Promise<string | null> {
  const spec = SPECS[key]
  try {
    const stripe = getStripeClient()

    const envCandidate = process.env[spec.envVar]?.trim()
    if (envCandidate && (await priceExistsInStripe(stripe, envCandidate))) {
      console.log("[growth-paywall]", { result: `${key}_price_resolved_env`, priceId: envCandidate })
      return envCandidate
    }

    const existing = await findPriceByLookupKey(stripe, spec.lookupKey)
    if (existing) {
      console.log("[growth-paywall]", {
        result: `${key}_price_resolved_lookup`,
        priceId: existing,
        lookupKey: spec.lookupKey,
      })
      return existing
    }

    const currency = growthCurrency()
    const product = await stripe.products.create({
      name: spec.productName,
      metadata: { affisell_feature: spec.featureMeta, affisell_lookup: spec.lookupKey },
    })

    const price = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: spec.unitAmountCents,
      recurring: { interval: spec.interval === "annual" ? "year" : "month" },
      lookup_key: spec.lookupKey,
      metadata: { affisell_feature: spec.featureMeta, plan: spec.plan, interval: spec.interval },
    })

    console.log("[growth-paywall]", {
      result: `${key}_price_auto_provisioned`,
      productId: product.id,
      priceId: price.id,
      currency,
      lookupKey: spec.lookupKey,
    })
    return price.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[growth-paywall]", { result: `${key}_price_ensure_failed`, message })
    return null
  }
}

/**
 * Resolve a Growth plan+interval Stripe price: validate env id (heal stale), then
 * lookup_key, then auto-create once. Mirrors lib/stripe-radar-ensure.ts.
 */
export async function resolveOrEnsureStripeGrowthPriceId(
  plan: GrowthPricingTierId,
  interval: GrowthBillingInterval
): Promise<string | null> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null

  const key = specKey(plan, interval)
  const cached = cache[key]
  if (cached) return cached

  if (!inFlight[key]) {
    inFlight[key] = ensurePriceForSpec(key)
      .then((id) => {
        cache[key] = id
        return id
      })
      .finally(() => {
        delete inFlight[key]
      })
  }
  return inFlight[key]!
}

export function __resetStripeGrowthPriceCacheForTests() {
  for (const key of Object.keys(SPECS) as GrowthSpecKey[]) {
    delete cache[key]
    delete inFlight[key]
  }
}
