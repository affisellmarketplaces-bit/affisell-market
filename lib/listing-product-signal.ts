import {
  extractProductTitleTokens,
  scoreProductTextAgainstBreadcrumb,
} from "@/lib/category-title-match"

/** Marketing / logistics noise — must not drive taxonomy. */
const TITLE_NOISE = new RegExp(
  [
    "\\b(livraison|gratuit|gratuite|promo|promotion|soldes|best\\s*seller|top\\s*vente|nouveau|nouvelle|edition|offre|flash|exclusif|premium|qualite|haute|ultra|super|mega|pack|lot|pcs|piece|pieces|couleur|taille|cm|mm|ml|g|kg|w|v|mah|usb|type\\s*c)\\b",
    "\\b(\\d+\\s*%|\\d+\\s*€|eur|usd|gbp)\\b",
    "\\b(202[3-9]|noir|blanc|bleu|rouge|vert|rose|gris|argent|or)\\b",
  ].join("|"),
  "gi"
)

const TITLE_SEGMENT_SPLIT = /[|/•·–—]+/

export type ListingProductContext = {
  /** Raw listing title from supplier */
  title: string
  /** Description + bullets combined */
  supplierDetails: string
  /** Heuristic core product name (from title) */
  productName: string
  /** Tokens that define what is being sold */
  coreTokens: string[]
  /** Line used for 80%+ of keyword / catalog scoring */
  classificationFocus: string
  /** 0–1 confidence in heuristic product name */
  nameConfidence: number
}

export type ListingProductInsight = {
  productName: string
  /** Short UI line: what the engine is optimizing for */
  focusLabel: string
}

function stripTitleNoise(segment: string): string {
  return segment
    .replace(TITLE_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extract the sellable product name from a marketplace title (before AI).
 * Prioritizes the leading segment and strong product tokens.
 */
export function extractProductIdentityFromTitle(title: string): {
  productName: string
  coreTokens: string[]
  confidence: number
} {
  const raw = title.trim()
  if (raw.length < 2) {
    return { productName: "", coreTokens: [], confidence: 0 }
  }

  const segments = raw
    .split(TITLE_SEGMENT_SPLIT)
    .map((s) => stripTitleNoise(s))
    .filter((s) => s.length >= 2)

  const primary = segments[0] ?? stripTitleNoise(raw)
  const tokens = extractProductTitleTokens(primary)
  const fallbackTokens = tokens.length > 0 ? tokens : extractProductTitleTokens(stripTitleNoise(raw))

  if (fallbackTokens.length === 0) {
    const words = stripTitleNoise(raw)
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 5)
    const productName = words.join(" ")
    return {
      productName,
      coreTokens: words,
      confidence: productName.length >= 4 ? 0.45 : 0.25,
    }
  }

  const productName = fallbackTokens.slice(0, 6).join(" ")
  const head = fallbackTokens.slice(0, 3)
  const confidence = Math.min(
    0.95,
    0.5 +
      Math.min(head.length, 3) * 0.12 +
      (primary.length >= 8 ? 0.15 : 0) +
      (segments.length === 1 ? 0.08 : 0)
  )

  return { productName, coreTokens: fallbackTokens, confidence }
}

export function buildListingProductContext(
  title: string,
  supplierDetails?: string
): ListingProductContext {
  const t = title.trim()
  const d = (supplierDetails ?? "").trim()
  const { productName, coreTokens, confidence } = extractProductIdentityFromTitle(t)
  const classificationFocus = productName.length >= 3 ? productName : t

  return {
    title: t,
    supplierDetails: d,
    productName,
    coreTokens,
    classificationFocus,
    nameConfidence: confidence,
  }
}

export function listingProductInsight(ctx: ListingProductContext): ListingProductInsight | null {
  if (ctx.title.length < 3) return null
  const name = ctx.productName || ctx.title
  return {
    productName: name,
    focusLabel:
      ctx.productName.length >= 3 && ctx.productName !== ctx.title
        ? `Analyse centrée sur « ${name} » (nom extrait du titre)`
        : `Analyse centrée sur le titre : « ${ctx.title.slice(0, 72)}${ctx.title.length > 72 ? "…" : ""} »`,
  }
}

/** Title-first breadcrumb score; supplier details only confirm. */
export function scoreListingContextAgainstBreadcrumb(
  ctx: ListingProductContext,
  breadcrumb: string
): number {
  const titleScore = scoreProductTextAgainstBreadcrumb(ctx.classificationFocus, breadcrumb)
  const rawTitleScore =
    ctx.classificationFocus !== ctx.title
      ? scoreProductTextAgainstBreadcrumb(ctx.title, breadcrumb) * 0.35
      : 0
  const detailScore = ctx.supplierDetails
    ? scoreProductTextAgainstBreadcrumb(ctx.supplierDetails, breadcrumb) * 0.22
    : 0
  return titleScore * 0.78 + rawTitleScore + detailScore
}

export function formatListingContextForAi(ctx: ListingProductContext): string {
  const lines = [
    "═══ PRIORITÉ 1 — NOM DU PRODUIT (TITRE LISTING) ═══",
    `Titre brut fournisseur: ${ctx.title}`,
    `Nom produit (extrait, à classer): ${ctx.productName || ctx.title}`,
    ctx.coreTokens.length
      ? `Mots-clés produit: ${ctx.coreTokens.join(", ")}`
      : null,
    "",
    "═══ PRIORITÉ 2 — DÉTAILS FOURNISSEUR (confirmation uniquement) ═══",
    ctx.supplierDetails.trim() || "(aucun détail — se baser uniquement sur le titre)",
    "",
    "═══ RÈGLE DE DÉCISION ═══",
    "La catégorie doit décrire le TYPE DE PRODUIT du titre (priorité 1).",
    "Les détails ne doivent jamais changer le type (ex. ventilateur + mention lampe → climatisation/ventilateurs, pas éclairage).",
    "Ignorer promos, couleurs, dimensions, livraison, marques seules.",
  ]
  return lines.filter((l) => l != null).join("\n")
}

/** Drop AI picks that contradict extracted product identity. */
export function breadcrumbConflictsWithIdentity(
  ctx: ListingProductContext,
  breadcrumb: string,
  aiExcludes: string[] = []
): boolean {
  const b = breadcrumb.toLowerCase()
  const focus = ctx.classificationFocus.toLowerCase()
  const tokens = ctx.coreTokens

  const fanLike =
    /\b(ventilat|brumisat|rafraich)\b/i.test(focus) ||
    tokens.some((t) => /ventilat|brumisat|rafraich/.test(t))
  if (fanLike && /\b(velo|cycl|surveillance|securit|lamp|eclairage|power\s*bank|banque\s*energie)\b/i.test(b)) {
    return true
  }

  const furnitureLike =
    /\b(commode|armoire|etagere|meuble|rangement|buffet)\b/i.test(focus) ||
    tokens.some((t) => /commode|armoire|etagere|meuble/.test(t))
  if (furnitureLike && /\b(sport|fitness|velo|electronique\s+embarqu)\b/i.test(b)) {
    return true
  }

  for (const ex of aiExcludes) {
    const e = ex.trim().toLowerCase()
    if (e.length >= 4 && b.includes(e)) return true
  }

  return false
}
