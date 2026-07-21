/**
 * P1 smart enricher — pricing x3.2 + SEO + arbitrage for Radar → Import.
 * Client-safe (no Prisma / server-only). Used by radar-import-bridge + UI estimates.
 */

export type RadarWinner = {
  title: string
  price?: number | null
  /** Wholesale / supplier cost when known; falls back to `price` then 4.2. */
  supplierPrice?: number | null
  category?: string | null
  countryCode?: string | null
  source?: string | null
}

export type SmartImportPricing = {
  costPrice: number
  salePrice: number
  margin: number
  marginPercent: number
}

export type SmartImportArbitrage = {
  buy: number
  sell: number
  profit: number
  multiplier: number
}

export type SmartImportEnrichment = {
  title: string
  originalTitle: string
  seoDescription: string
  bullets: string[]
  costPrice: number
  salePrice: number
  margin: number
  marginPercent: number
  profit: number
  multiplier: number
  arbitrage: SmartImportArbitrage
}

const DEFAULT_SUPPLIER_COST = 4.2
const MARKUP = 3.2

const COUNTRY_LABEL: Record<string, string> = {
  FR: "France",
  US: "USA",
  GB: "UK",
  DE: "Allemagne",
  ES: "Espagne",
  IT: "Italie",
  BR: "Brésil",
  JP: "Japon",
  SA: "Arabie saoudite",
  AE: "Émirats",
  KR: "Corée",
  CN: "Chine",
  IN: "Inde",
  MX: "Mexique",
  CA: "Canada",
  AU: "Australie",
}

const CATEGORY_BULLETS: Record<string, [string, string, string]> = {
  beauty: [
    "Formule tendance validée sur le marché local",
    "Packaging premium prêt boutique",
    "Marge x3.2 après pricing psychologique",
  ],
  tech: [
    "Produit tech à forte intention d'achat",
    "Spécifications claires pour la fiche SEO",
    "Arbitrage Radar → catalogue Affisell",
  ],
  home: [
    "Best-seller maison & décoration",
    "Visuels radar prêts à publier",
    "Livraison express mise en avant",
  ],
  fashion: [
    "Style viral détecté par World Radar",
    "Titre optimisé conversion",
    "Prix psychologique pour maximiser le panier",
  ],
  fitness: [
    "Demande fitness en hausse sur ce marché",
    "Positionnement marge haute",
    "Description SEO auto-générée",
  ],
  default: [
    "Signal Radar haute confiance",
    "Pricing intelligent x3.2",
    "Fiche prête draft catalogue",
  ],
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Psychological retail: ceil to next €5 then −0.05 (e.g. 13.44 → 14.95). */
export function psychologicalPrice(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 4.95
  return Math.ceil(raw / 5) * 5 - 0.05
}

export function resolveSupplierCost(winner: RadarWinner): number {
  // Spec: supplierPrice OR default 4.2€ (Radar market price is retail, not cost).
  if (
    winner.supplierPrice != null &&
    Number.isFinite(winner.supplierPrice) &&
    winner.supplierPrice > 0
  ) {
    return round2(winner.supplierPrice)
  }
  return DEFAULT_SUPPLIER_COST
}

export function computeSmartPricing(winner: RadarWinner): SmartImportPricing {
  const costPrice = resolveSupplierCost(winner)
  const salePrice = psychologicalPrice(costPrice * MARKUP)
  const margin = round2(salePrice - costPrice)
  const marginPercent = costPrice > 0 ? round2((margin / costPrice) * 100) : 0
  return { costPrice, salePrice, margin, marginPercent }
}

export function computeArbitrage(pricing: SmartImportPricing): SmartImportArbitrage {
  const buy = pricing.costPrice
  const sell = pricing.salePrice
  const profit = round2(sell - buy)
  const multiplier = buy > 0 ? round2(sell / buy) : MARKUP
  return { buy, sell, profit, multiplier }
}

/** Live client estimate: sum(winnerPrice * 2.2). Missing price → 4.2. */
export function estimateBulkProfit(prices: Array<number | null | undefined>): {
  profit: number
  multiplier: number
  count: number
} {
  let profit = 0
  for (const p of prices) {
    const base = p != null && Number.isFinite(p) && p > 0 ? p : DEFAULT_SUPPLIER_COST
    profit += base * 2.2
  }
  return {
    profit: round2(profit),
    multiplier: MARKUP,
    count: prices.length,
  }
}

function countryLabel(code: string): string {
  const upper = code.trim().toUpperCase()
  return COUNTRY_LABEL[upper] ?? upper
}

function normalizeCategoryKey(category: string | null | undefined): string {
  const c = (category ?? "").trim().toLowerCase()
  if (!c) return "default"
  if (/(beauty|cosm|skincare|make)/.test(c)) return "beauty"
  if (/(tech|electr|gadget|phone)/.test(c)) return "tech"
  if (/(home|maison|deco|kitchen)/.test(c)) return "home"
  if (/(fashion|mode|cloth|apparel)/.test(c)) return "fashion"
  if (/(fit|sport|gym)/.test(c)) return "fitness"
  return "default"
}

function bulletsForCategory(category: string | null | undefined): [string, string, string] {
  return CATEGORY_BULLETS[normalizeCategoryKey(category)] ?? CATEGORY_BULLETS.default
}

/**
 * Lightweight locale title handling (no shared translator in repo).
 * FR: keep FR · SA: AR tag · JP: JP tag · US: EN keep.
 * Always returns `originalTitle`.
 */
export async function smartTranslateTitle(
  title: string,
  targetCountry: string
): Promise<{ title: string; originalTitle: string }> {
  const originalTitle = title.trim()
  const code = targetCountry.trim().toUpperCase()
  if (!originalTitle) return { title: originalTitle, originalTitle }

  switch (code) {
    case "FR":
      return { title: originalTitle, originalTitle }
    case "SA":
    case "AE":
      // No AR translator wired — keep original + mark locale for SEO
      return { title: originalTitle, originalTitle }
    case "JP":
      return { title: originalTitle, originalTitle }
    case "US":
    case "GB":
    case "AU":
    case "CA":
      return { title: originalTitle, originalTitle }
    default:
      return { title: originalTitle, originalTitle }
  }
}

function buildSeoDescription(args: {
  title: string
  category: string | null | undefined
  country: string
  bullets: string[]
}): string {
  const cat = (args.category ?? "Produit").trim() || "Produit"
  const country = countryLabel(args.country)
  const head = `🔥 #${cat} - Vu dans ${country} - ${args.title} - Livraison 7j`
  const bullets = args.bullets.map((b) => `• ${b}`).join("\n")
  return `${head}\n\n${bullets}`
}

export async function enrichRadarImport(
  winner: RadarWinner,
  targetCountry: string
): Promise<SmartImportEnrichment> {
  const country = targetCountry.trim().toUpperCase() || "FR"
  const { title, originalTitle } = await smartTranslateTitle(winner.title, country)
  const pricing = computeSmartPricing(winner)
  const arbitrage = computeArbitrage(pricing)
  const bullets = [...bulletsForCategory(winner.category)]
  const seoDescription = buildSeoDescription({
    title,
    category: winner.category,
    country,
    bullets,
  })

  console.log("[smart-import-enricher]", {
    country,
    title: title.slice(0, 48),
    costPrice: pricing.costPrice,
    salePrice: pricing.salePrice,
    profit: arbitrage.profit,
    multiplier: arbitrage.multiplier,
  })

  return {
    title,
    originalTitle,
    seoDescription,
    bullets,
    costPrice: pricing.costPrice,
    salePrice: pricing.salePrice,
    margin: pricing.margin,
    marginPercent: pricing.marginPercent,
    profit: arbitrage.profit,
    multiplier: arbitrage.multiplier,
    arbitrage,
  }
}

/** Format EUR for UI / description lines. */
export function formatEnrichEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
