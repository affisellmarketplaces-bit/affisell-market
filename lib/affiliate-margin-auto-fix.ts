import {
  suggestAiMarginsByVariantKey,
  suggestGlobalAiPriceEUR,
} from "@/lib/affiliate-ai-variant-pricing"
import {
  buildWholesaleSnapshot,
  listingMarginReviewIsResolved,
  wholesaleForKey,
} from "@/lib/affiliate-wholesale-change-guard"
import {
  marginEuroFromPrices,
  parseAffiliateVariantPricingJson,
  sellingPriceCentsFromMargin,
  type AffiliateVariantPricingMap,
} from "@/lib/affiliate-variant-pricing"

const MIN_MARGIN_EUR = 0.05

export type MarginAutoFixOption = {
  key: string
  wholesaleCents: number
}

export type MarginAutoFixInput = {
  baseWholesaleCents: number
  sellingPriceCents: number
  variantPricing: unknown
  reviewVariantKeys: string[]
  options: MarginAutoFixOption[]
  currentMarginEuroByKey: Record<string, string>
  rng?: () => number
}

export type MarginAutoFixResult = {
  marginEuroByKey: Record<string, string>
  referencePriceEUR: string | null
  keysFixed: string[]
  resolved: boolean
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase()
}

/** Keys that need a margin bump: review flags + any SKU selling below wholesale. */
export function pickVariantKeysNeedingMarginFix(args: {
  options: MarginAutoFixOption[]
  variantPricing: AffiliateVariantPricingMap | null
  sellingPriceCents: number
  reviewVariantKeys: string[]
}): string[] {
  const pricing = args.variantPricing ?? {}
  const pricingKeys = Object.keys(pricing)
  const out = new Set<string>()

  for (const raw of args.reviewVariantKeys) {
    const trimmed = raw.trim()
    if (trimmed) out.add(trimmed)
  }

  if (pricingKeys.length > 0) {
    for (const opt of args.options) {
      const entry = pricing[opt.key] ?? pricing[Object.keys(pricing).find((k) => k.toLowerCase() === opt.key.toLowerCase()) ?? ""]
      if (!entry) continue
      if (entry.sellingPriceCents < opt.wholesaleCents) {
        out.add(opt.key)
      }
    }
    return [...out]
  }

  if (args.sellingPriceCents < args.options[0]?.wholesaleCents) {
    return args.options.map((o) => o.key)
  }

  return [...out]
}

function ensureSafeMarginEuro(args: {
  wholesaleCents: number
  marginEuro: number
  globalSuggestedSellEUR: number
}): number {
  let marginEuro = args.marginEuro
  let sell = sellingPriceCentsFromMargin({
    wholesaleCents: args.wholesaleCents,
    marginEuro,
  })
  if (sell >= args.wholesaleCents) {
    return Math.max(MIN_MARGIN_EUR, Math.round(marginEuro * 100) / 100)
  }

  const wholesaleEUR = args.wholesaleCents / 100
  const targetSell = Math.max(args.globalSuggestedSellEUR, wholesaleEUR + MIN_MARGIN_EUR)
  marginEuro = Math.max(MIN_MARGIN_EUR, targetSell - wholesaleEUR)
  sell = sellingPriceCentsFromMargin({
    wholesaleCents: args.wholesaleCents,
    marginEuro,
  })
  if (sell < args.wholesaleCents) {
    marginEuro = marginEuroFromPrices(args.wholesaleCents, args.wholesaleCents + 100)
  }
  return Math.max(MIN_MARGIN_EUR, Math.round(marginEuro * 100) / 100)
}

export function suggestSafeMarginsAfterWholesaleIncrease(
  input: MarginAutoFixInput
): MarginAutoFixResult {
  const variantPricing = parseAffiliateVariantPricingJson(input.variantPricing)
  const pricingKeys = Object.keys(variantPricing)
  const baseWholesaleCents = Math.max(100, Math.round(input.baseWholesaleCents))
  const globalSuggested = suggestGlobalAiPriceEUR(baseWholesaleCents / 100, input.rng)

  if (pricingKeys.length === 0 && input.options.length <= 1) {
    const wholesaleCents = input.options[0]?.wholesaleCents ?? baseWholesaleCents
    const safeSellEUR = Math.max(
      globalSuggested,
      wholesaleCents / 100 + MIN_MARGIN_EUR,
      input.sellingPriceCents / 100
    )
    const wholesaleAfter = buildWholesaleSnapshot({
      basePriceCents: wholesaleCents,
      variants: null,
      hasVariants: false,
    })
    const referencePriceEUR = safeSellEUR.toFixed(2)
    const resolved = listingMarginReviewIsResolved({
      sellingPriceCents: Math.round(safeSellEUR * 100),
      variantPricing: null,
      wholesaleAfter,
    })
    return {
      marginEuroByKey: {},
      referencePriceEUR,
      keysFixed: [],
      resolved,
    }
  }

  const keysToFix = pickVariantKeysNeedingMarginFix({
    options: input.options,
    variantPricing: Object.keys(variantPricing).length > 0 ? variantPricing : null,
    sellingPriceCents: input.sellingPriceCents,
    reviewVariantKeys: input.reviewVariantKeys,
  })

  const aiMargins = suggestAiMarginsByVariantKey({
    options: input.options.map((o) => ({ key: o.key, wholesaleCents: o.wholesaleCents })),
    selectedKeys: keysToFix.length > 0 ? keysToFix : input.options.map((o) => o.key),
    baseWholesaleCents,
    globalSuggestedSellEUR: globalSuggested,
  })

  const marginEuroByKey: Record<string, string> = { ...input.currentMarginEuroByKey }
  const keysFixed: string[] = []

  for (const key of keysToFix.length > 0 ? keysToFix : input.options.map((o) => o.key)) {
    const opt = input.options.find((o) => normalizeKey(o.key) === normalizeKey(key))
    if (!opt) continue
    const rawAi = aiMargins[key] ?? aiMargins[opt.key]
    const parsedAi = Number(String(rawAi ?? "").replace(",", "."))
    const baseMargin = Number.isFinite(parsedAi)
      ? parsedAi
      : marginEuroFromPrices(opt.wholesaleCents, globalSuggested * 100)
    const safeMargin = ensureSafeMarginEuro({
      wholesaleCents: opt.wholesaleCents,
      marginEuro: baseMargin,
      globalSuggestedSellEUR: globalSuggested,
    })
    marginEuroByKey[opt.key] = safeMargin.toFixed(2)
    keysFixed.push(opt.key)
  }

  const nextPricing = buildPricingPreview({
    options: input.options,
    marginEuroByKey,
    existingPricing: variantPricing,
  })

  const wholesaleAfter = buildWholesaleSnapshot({
    basePriceCents: baseWholesaleCents,
    variants: {
      variantRows: input.options.map((o) => ({
        name: o.key,
        priceCents: o.wholesaleCents,
      })),
    },
    hasVariants: input.options.length > 1,
  })

  const resolved = listingMarginReviewIsResolved({
    sellingPriceCents: input.sellingPriceCents,
    variantPricing: nextPricing,
    wholesaleAfter,
  })

  return {
    marginEuroByKey,
    referencePriceEUR: globalSuggested.toFixed(2),
    keysFixed,
    resolved,
  }
}

function buildPricingPreview(args: {
  options: MarginAutoFixOption[]
  marginEuroByKey: Record<string, string>
  existingPricing: AffiliateVariantPricingMap
}): AffiliateVariantPricingMap {
  const out: AffiliateVariantPricingMap = { ...args.existingPricing }
  for (const opt of args.options) {
    const raw = args.marginEuroByKey[opt.key]
    const marginEuro = Number(String(raw ?? "").replace(",", "."))
    if (!Number.isFinite(marginEuro) || marginEuro < 0) continue
    out[opt.key] = {
      sellingPriceCents: sellingPriceCentsFromMargin({
        wholesaleCents: opt.wholesaleCents,
        marginEuro,
      }),
      marginCents: Math.max(
        0,
        sellingPriceCentsFromMargin({ wholesaleCents: opt.wholesaleCents, marginEuro }) -
          opt.wholesaleCents
      ),
    }
  }
  return out
}

export function wholesaleSnapshotFromOptions(args: {
  baseWholesaleCents: number
  options: MarginAutoFixOption[]
}) {
  const variantWholesaleCents: Record<string, number> = {}
  for (const opt of args.options) {
    variantWholesaleCents[opt.key] = opt.wholesaleCents
  }
  return {
    basePriceCents: args.baseWholesaleCents,
    variantWholesaleCents,
  }
}

export function isVariantPricingResolved(args: {
  options: MarginAutoFixOption[]
  variantPricing: AffiliateVariantPricingMap | null
  sellingPriceCents: number
  baseWholesaleCents: number
}): boolean {
  const wholesaleAfter = buildWholesaleSnapshot({
    basePriceCents: args.baseWholesaleCents,
    variants: {
      variantRows: args.options.map((o) => ({ name: o.key, priceCents: o.wholesaleCents })),
    },
    hasVariants: args.options.length > 1,
  })
  return listingMarginReviewIsResolved({
    sellingPriceCents: args.sellingPriceCents,
    variantPricing: args.variantPricing,
    wholesaleAfter,
  })
}

/** @internal test helper */
export function wholesaleCentsForOptionKey(
  snapshot: ReturnType<typeof buildWholesaleSnapshot>,
  key: string
): number {
  return wholesaleForKey(snapshot, key)
}
