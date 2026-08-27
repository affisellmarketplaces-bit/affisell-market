/** Client-safe helpers for the 4-step guided supplier wizard (no Prisma). */

export const GUIDED_WIZARD_CATEGORIES = [
  { label: "Fashion", value: "Clothing, Shoes & Jewelry" },
  { label: "Home", value: "Home & Kitchen" },
  { label: "Beauty", value: "Beauty & Personal Care" },
  { label: "Food", value: "Grocery & Gourmet Food" },
] as const

export type GuidedCategoryLabel = (typeof GUIDED_WIZARD_CATEGORIES)[number]["label"]

export type GuidedTitleScore = {
  label: string
  tone: "good" | "warn" | "bad"
}

export type GuidedProductAiSuggestion = {
  recommendedTitle: string | null
  titleVariants: string[]
  subtitle: string | null
  seoKeywords: string[]
  insight: string | null
  category: GuidedCategoryLabel | null
  categoryConfidence: number
  categoryReason: string | null
  attributes: {
    material: string | null
    color: string | null
    dimensions: string | null
    suggestedPrice: number | null
  }
  visionUsed: boolean
  source: "none" | "ai" | "hybrid" | "fallback"
  fallback: boolean
}

export const EMPTY_GUIDED_AI_SUGGESTION: GuidedProductAiSuggestion = {
  recommendedTitle: null,
  titleVariants: [],
  subtitle: null,
  seoKeywords: [],
  insight: null,
  category: null,
  categoryConfidence: 0,
  categoryReason: null,
  attributes: {
    material: null,
    color: null,
    dimensions: null,
    suggestedPrice: null,
  },
  visionUsed: false,
  source: "none",
  fallback: false,
}

const GUIDED_CATEGORY_PATTERNS: Record<GuidedCategoryLabel, RegExp[]> = {
  Fashion: [
    /\bfashion\b/i,
    /\bclothing\b/i,
    /\bshoes\b/i,
    /\bjewelry\b/i,
    /\bvetements?\b/i,
    /\bhauts?\b/i,
    /\bchaussures?\b/i,
    /\bbijoux\b/i,
    /\baccessoires?\b/i,
    /\bsacs?\b/i,
    /\bmode\b/i,
  ],
  Home: [
    /\bhome\b/i,
    /\bkitchen\b/i,
    /\bmaison\b/i,
    /\bcuisine\b/i,
    /\bmeubles?\b/i,
    /\bjardin\b/i,
    /\bbricolage\b/i,
    /\belectromenager\b/i,
    /\bdeco\b/i,
  ],
  Beauty: [
    /\bbeauty\b/i,
    /\bbeaute\b/i,
    /\bcosmet/i,
    /\bparfum/i,
    /\bsoins?\b/i,
    /\bmaquillage\b/i,
    /\bhygiene\b/i,
    /\bpeau\b/i,
  ],
  Food: [
    /\bfood\b/i,
    /\bgrocery\b/i,
    /\bgourmet\b/i,
    /\baliment/i,
    /\bepicerie\b/i,
    /\bboisson/i,
    /\bcafe\b/i,
    /\bthe\b/i,
  ],
}

const GUIDED_VALUE_TO_LABEL = Object.fromEntries(
  GUIDED_WIZARD_CATEGORIES.map((c) => [c.value.toLowerCase(), c.label])
) as Record<string, GuidedCategoryLabel>

/** Map Affisell breadcrumb / Amazon-style category to guided wizard bucket. */
export function mapTextToGuidedCategory(text: string): GuidedCategoryLabel | null {
  const normalized = text.trim()
  if (!normalized) return null

  const direct = GUIDED_VALUE_TO_LABEL[normalized.toLowerCase()]
  if (direct) return direct

  const lower = normalized.toLowerCase()
  const ascii = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  for (const entry of GUIDED_WIZARD_CATEGORIES) {
    if (lower.includes(entry.label.toLowerCase()) || lower.includes(entry.value.toLowerCase())) {
      return entry.label
    }
  }

  let best: { label: GuidedCategoryLabel; score: number } | null = null
  for (const [label, patterns] of Object.entries(GUIDED_CATEGORY_PATTERNS) as Array<
    [GuidedCategoryLabel, RegExp[]]
  >) {
    const score = patterns.reduce(
      (acc, rx) => acc + (rx.test(lower) || rx.test(ascii) ? 1 : 0),
      0
    )
    if (score > 0 && (!best || score > best.score)) {
      best = { label, score }
    }
  }
  return best?.label ?? null
}

export function scoreGuidedTitleLength(len: number): GuidedTitleScore {
  if (len >= 45 && len <= 110) {
    return { label: "Longueur SEO optimale", tone: "good" }
  }
  if (len >= 25 && len < 45) {
    return { label: "Enrichir le bénéfice client", tone: "warn" }
  }
  if (len > 110) {
    return { label: "Risque de troncature marketplace", tone: "bad" }
  }
  return { label: "Titre trop court", tone: "bad" }
}

export function formatGuidedPrice(value: number | null): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value.toFixed(2).replace(".", ",")
}
