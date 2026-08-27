/** Client-safe helpers for the 4-step guided supplier wizard (no Prisma). */

export const GUIDED_WIZARD_CATEGORIES = [
  { label: "Fashion", value: "Clothing, Shoes & Jewelry", hint: "Mode · vêtements · chaussures · accessoires" },
  { label: "Home", value: "Home & Kitchen", hint: "Maison · déco · cuisine · high-tech · jardin" },
  { label: "Beauty", value: "Beauty & Personal Care", hint: "Beauté · soins · maquillage · parfums" },
  { label: "Food", value: "Grocery & Gourmet Food", hint: "Alimentation · boissons · épicerie fine" },
] as const

export type GuidedCategoryLabel = (typeof GUIDED_WIZARD_CATEGORIES)[number]["label"]

export type GuidedCategoryScore = {
  label: GuidedCategoryLabel
  confidence: number
  reason?: string
}

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
  /** Scores for all 4 wizard buckets — always aligned with existing choices. */
  categoryScores: GuidedCategoryScore[]
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

export const GUIDED_CATEGORY_LABELS: GuidedCategoryLabel[] = GUIDED_WIZARD_CATEGORIES.map(
  (c) => c.label
)

export const EMPTY_GUIDED_AI_SUGGESTION: GuidedProductAiSuggestion = {
  recommendedTitle: null,
  titleVariants: [],
  subtitle: null,
  seoKeywords: [],
  insight: null,
  category: null,
  categoryConfidence: 0,
  categoryReason: null,
  categoryScores: [],
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

const GUIDED_CATEGORY_KEYWORDS: Record<GuidedCategoryLabel, RegExp[]> = {
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
    /\bt[- ]?shirt\b/i,
    /\bjeans?\b/i,
    /\brobe\b/i,
    /\bpull\b/i,
    /\bmanteau\b/i,
    /\blingerie\b/i,
    /\bbaskets?\b/i,
    /\bsneakers?\b/i,
    /\bmontre\b/i,
    /\bbracelet\b/i,
    /\bcollier\b/i,
    /\bboucles?\s*d['']oreilles\b/i,
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
    /\blampe\b/i,
    /\bcanape\b/i,
    /\baspirateur\b/i,
    /\bhigh[- ]?tech\b/i,
    /\belectronique\b/i,
    /\bsmartphone\b/i,
    /\btelephone\b/i,
    /\btablette\b/i,
    /\benceinte\b/i,
    /\btelevision\b/i,
    /\boutil\b/i,
    /\bustensile\b/i,
    /\bvaisselle\b/i,
    /\bliterie\b/i,
    /\boreiller\b/i,
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
    /\bserum\b/i,
    /\bcreme\b/i,
    /\bshampoo/i,
    /\bmasque\s*capillaire\b/i,
    /\brouge\s*a\s*levres\b/i,
    /\bmascara\b/i,
    /\bdeodorant\b/i,
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
    /\bchocolat\b/i,
    /\bsnack\b/i,
    /\bvin\b/i,
    /\bconfiture\b/i,
    /\bmiel\b/i,
  ],
}

const GUIDED_VALUE_TO_LABEL = Object.fromEntries(
  GUIDED_WIZARD_CATEGORIES.map((c) => [c.value.toLowerCase(), c.label])
) as Record<string, GuidedCategoryLabel>

function normalizeGuidedText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
}

/** Score all 4 wizard categories from product text — instant client/server fallback. */
export function scoreGuidedCategoriesFromText(text: string): GuidedCategoryScore[] {
  const raw = text.trim()
  if (!raw) {
    return GUIDED_CATEGORY_LABELS.map((label) => ({ label, confidence: 0 }))
  }

  const lower = raw.toLowerCase()
  const ascii = normalizeGuidedText(raw)

  const scores = GUIDED_CATEGORY_LABELS.map((label) => {
    let hits = 0
    for (const rx of GUIDED_CATEGORY_KEYWORDS[label]) {
      if (rx.test(lower) || rx.test(ascii)) hits += 1
    }
    const mapped = mapTextToGuidedCategory(raw)
    if (mapped === label) hits += 3
    const confidence = hits > 0 ? Math.min(0.92, 0.28 + hits * 0.14) : 0
    return { label, confidence, reason: hits > 0 ? "Analyse titre & contexte" : undefined }
  })

  return scores.sort((a, b) => b.confidence - a.confidence)
}

export function pickGuidedCategoryFromScores(
  scores: GuidedCategoryScore[],
  opts?: { minConfidence?: number }
): { category: GuidedCategoryLabel; confidence: number; reason: string | null } | null {
  const minConfidence = opts?.minConfidence ?? 0.28
  const sorted = [...scores].sort((a, b) => b.confidence - a.confidence)
  const top = sorted[0]
  const second = sorted[1]
  if (!top || top.confidence < minConfidence) return null

  const gap = second ? top.confidence - second.confidence : top.confidence
  if (top.confidence >= 0.45 || gap >= 0.12) {
    return {
      category: top.label,
      confidence: top.confidence,
      reason: top.reason ?? null,
    }
  }
  return null
}

/** Merge multiple score lists — keeps max confidence per label. */
export function mergeGuidedCategoryScores(
  ...lists: GuidedCategoryScore[][]
): GuidedCategoryScore[] {
  const byLabel = new Map<GuidedCategoryLabel, GuidedCategoryScore>()
  for (const label of GUIDED_CATEGORY_LABELS) {
    byLabel.set(label, { label, confidence: 0 })
  }
  for (const list of lists) {
    for (const row of list) {
      if (!GUIDED_CATEGORY_LABELS.includes(row.label)) continue
      const prev = byLabel.get(row.label)!
      if (row.confidence > prev.confidence) {
        byLabel.set(row.label, {
          label: row.label,
          confidence: Math.min(0.98, row.confidence),
          reason: row.reason ?? prev.reason,
        })
      }
    }
  }
  return [...byLabel.values()].sort((a, b) => b.confidence - a.confidence)
}

export function shouldAutoApplyGuidedCategory(
  confidence: number,
  opts?: { visionUsed?: boolean; userEdited?: boolean; currentCategory?: string }
): boolean {
  if (opts?.userEdited) return false
  if (opts?.currentCategory) return false
  if (opts?.visionUsed) return confidence >= 0.32
  return confidence >= 0.38
}

/** Map Affisell breadcrumb / Amazon-style category to guided wizard bucket. */
export function mapTextToGuidedCategory(text: string): GuidedCategoryLabel | null {
  const normalized = text.trim()
  if (!normalized) return null

  const direct = GUIDED_VALUE_TO_LABEL[normalized.toLowerCase()]
  if (direct) return direct

  const lower = normalized.toLowerCase()
  const ascii = normalizeGuidedText(normalized)

  for (const entry of GUIDED_WIZARD_CATEGORIES) {
    if (lower.includes(entry.label.toLowerCase()) || lower.includes(entry.value.toLowerCase())) {
      return entry.label
    }
  }

  let best: { label: GuidedCategoryLabel; score: number } | null = null
  for (const [label, patterns] of Object.entries(GUIDED_CATEGORY_KEYWORDS) as Array<
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
