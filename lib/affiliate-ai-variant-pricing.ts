import type { AffiliateVariantPricingMap } from "@/lib/affiliate-variant-pricing"

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

export function estimateMonthlySales(priceEUR: number, supplierEUR: number): number {
  return Math.floor(clamp(25 - (priceEUR - supplierEUR) * 0.8, 6, 40))
}

export function suggestGlobalAiPriceEUR(supplierEUR: number, rng: () => number = Math.random): number {
  const m = 1.35 + rng() * 0.2
  const raw = Math.round(supplierEUR * m * 10) / 10
  const minSell = Math.round((supplierEUR + 0.05) * 100) / 100
  return Number.isFinite(raw) && raw >= minSell ? raw : minSell
}

/** Per-SKU margin scaled from global AI suggestion vs base wholesale. */
export function suggestAiMarginEuroForVariant(args: {
  wholesaleCents: number
  baseWholesaleCents: number
  globalSuggestedSellEUR: number
}): number {
  const baseEUR = args.baseWholesaleCents / 100
  const wholesaleEUR = args.wholesaleCents / 100
  const globalMargin = Math.max(0, args.globalSuggestedSellEUR - baseEUR)
  if (baseEUR <= 0) return Math.max(0.05, globalMargin)
  const premiumRatio = Math.max(0, (wholesaleEUR - baseEUR) / baseEUR)
  const scaled = globalMargin * (1 + premiumRatio * 0.15)
  return Math.max(0.05, Math.round(scaled * 100) / 100)
}

export function suggestAiMarginsByVariantKey(args: {
  options: Array<{ key: string; wholesaleCents: number }>
  selectedKeys: string[]
  baseWholesaleCents: number
  globalSuggestedSellEUR: number
}): Record<string, string> {
  const out: Record<string, string> = {}
  const selected = new Set(args.selectedKeys.map((k) => k.toLowerCase()))
  for (const opt of args.options) {
    if (!selected.has(opt.key.toLowerCase())) continue
    const margin = suggestAiMarginEuroForVariant({
      wholesaleCents: opt.wholesaleCents,
      baseWholesaleCents: args.baseWholesaleCents,
      globalSuggestedSellEUR: args.globalSuggestedSellEUR,
    })
    out[opt.key] = margin.toFixed(2)
  }
  return out
}

/** Deterministic daily ±5% factor (listing + variant + UTC date). */
export function dailyPricingJitterFactor(
  listingId: string,
  variantKey: string,
  dateKey: string
): number {
  let h = 0
  const s = `${listingId}:${variantKey}:${dateKey}`
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  const t = (h % 10001) / 10000
  return 0.95 + t * 0.1
}

export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function adjustVariantPricingForDailyCron(args: {
  listingId: string
  variantPricing: AffiliateVariantPricingMap
  wholesaleByKey: Map<string, number>
  dateKey: string
}): {
  next: AffiliateVariantPricingMap
  changed: Array<{ key: string; oldCents: number; newCents: number }>
} {
  const next: AffiliateVariantPricingMap = {}
  const changed: Array<{ key: string; oldCents: number; newCents: number }> = []

  for (const [k, entry] of Object.entries(args.variantPricing)) {
    const wholesale = args.wholesaleByKey.get(k) ?? 0
    const factor = dailyPricingJitterFactor(args.listingId, k, args.dateKey)
    const newSell = Math.max(wholesale, Math.round(entry.sellingPriceCents * factor))
    next[k] = {
      sellingPriceCents: newSell,
      marginCents: Math.max(0, newSell - wholesale),
    }
    if (newSell !== entry.sellingPriceCents) {
      changed.push({ key: k, oldCents: entry.sellingPriceCents, newCents: newSell })
    }
  }

  return { next, changed }
}
