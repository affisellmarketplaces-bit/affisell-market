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
const MAX_HINTS_CHARS = 220
/** Prose longer than this requires a title keyword to be kept. */
const MAX_UNCONFIRMED_PROSE_CHARS = 40

/** Known product head nouns — anchor classification on these, not brands. */
const PRODUCT_HEAD_NOUN = new RegExp(
  [
    "moustiquaire",
    "ventilateur",
    "commode",
    "armoire",
    "casque",
    "ecouteur",
    "montre",
    "bracelet",
    "dashcam",
    "camera",
    "caméra",
    "poele",
    "casserole",
    "meuble",
    "etagere",
    "étagère",
  ].join("|"),
  "i"
)

export type ListingProductContext = {
  /** Raw listing title from supplier */
  title: string
  /** Filtered supplier hints (bullets + short specs) — never long SEO prose */
  supplierHints: string
  /** Heuristic core product name (from title only) */
  productName: string
  /** Tokens that define what is being sold */
  coreTokens: string[]
  /** Line used for 100% of category scoring */
  classificationFocus: string
  /** 0–1 confidence in heuristic product name */
  nameConfidence: number
}

export type ListingProductInsight = {
  productName: string
  focusLabel: string
  /** True when a long description was excluded from categorization */
  descriptionExcluded: boolean
}

function stripTitleNoise(segment: string): string {
  return segment
    .replace(TITLE_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Drop leading brand token when followed by a clear product noun (4umor moustiquaire → moustiquaire). */
function stripLeadingBrandToken(tokens: string[]): string[] {
  if (tokens.length < 2) return tokens
  const nounIdx = tokens.findIndex((t) => PRODUCT_HEAD_NOUN.test(t))
  if (nounIdx > 0) return tokens.slice(nounIdx)
  const first = tokens[0]!
  const second = tokens[1]!
  const looksLikeBrand =
    /^[a-z0-9][a-z0-9-]{2,11}$/i.test(first) &&
    !PRODUCT_HEAD_NOUN.test(first) &&
    !/^(mini|max|pro|plus|usb|led|pvc|abs)$/i.test(first)
  if (looksLikeBrand && second.length >= 5) return tokens.slice(1)
  return tokens
}

function isLikelyBrandToken(token: string): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{2,11}$/i.test(token) &&
    !PRODUCT_HEAD_NOUN.test(token) &&
    !/^(mini|max|pro|plus|usb|led|pvc|abs|porte|fenetre)$/i.test(token)
  )
}

function anchorProductName(tokens: string[]): { name: string; tokens: string[] } {
  const stripped = stripLeadingBrandToken(tokens)
  const nounIdx = stripped.findIndex((t) => PRODUCT_HEAD_NOUN.test(t))
  if (nounIdx >= 0) {
    const slice = stripped
      .slice(nounIdx, nounIdx + 5)
      .filter((t) => PRODUCT_HEAD_NOUN.test(t) || !isLikelyBrandToken(t))
    return { name: slice.join(" "), tokens: slice }
  }
  const cleaned = stripped.filter((t) => !isLikelyBrandToken(t))
  return { name: cleaned.slice(0, 5).join(" "), tokens: cleaned.slice(0, 5) }
}

function proseConfirmsProductTitle(prose: string, titleTokens: string[]): boolean {
  const norm = prose.toLowerCase()
  const headTokens = titleTokens.filter((t) => PRODUCT_HEAD_NOUN.test(t) || t.length >= 6)
  if (headTokens.length === 0) {
    return titleTokens.some((t) => t.length >= 5 && norm.includes(t))
  }
  return headTokens.some((t) => norm.includes(t))
}

/**
 * Build supplier hints for category ONLY — bullets and short specs.
 * Long SEO/marketing descriptions are excluded unless a sentence confirms the title.
 */
export function buildSupplierHintsForCategory(
  title: string,
  description?: string,
  bullets?: string[]
): { hints: string; descriptionExcluded: boolean } {
  const { coreTokens: titleTokens } = extractProductIdentityFromTitle(title)
  const parts: string[] = []
  let descriptionExcluded = false

  for (const raw of bullets ?? []) {
    const b = raw.trim()
    if (b.length >= 3 && b.length <= 120) parts.push(b)
  }

  const prose = (description ?? "").trim()
  if (prose.length === 0) {
    return { hints: [...new Set(parts)].join(" | ").slice(0, MAX_HINTS_CHARS), descriptionExcluded }
  }

  const proseConfirmsTitle = proseConfirmsProductTitle(prose, titleTokens)

  if (prose.length <= MAX_UNCONFIRMED_PROSE_CHARS && proseConfirmsTitle) {
    parts.push(prose)
  } else if (proseConfirmsTitle) {
    for (const chunk of prose.split(/[\n.!?]+/)) {
      const c = chunk.trim()
      if (c.length < 8 || c.length > 100) continue
      if (proseConfirmsProductTitle(c, titleTokens)) parts.push(c)
    }
    if (parts.length === (bullets ?? []).filter((b) => b.trim().length >= 3).length) {
      descriptionExcluded = true
    }
  } else {
    descriptionExcluded = true
  }

  return {
    hints: [...new Set(parts)].join(" | ").slice(0, MAX_HINTS_CHARS),
    descriptionExcluded,
  }
}

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
  let tokens = extractProductTitleTokens(primary)
  if (tokens.length === 0) tokens = extractProductTitleTokens(stripTitleNoise(raw))
  const anchored = anchorProductName(tokens)
  tokens = anchored.tokens

  if (tokens.length === 0) {
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

  const productName = anchored.name
  const head = tokens.slice(0, 3)
  const confidence = Math.min(
    0.95,
    0.5 +
      Math.min(head.length, 3) * 0.12 +
      (primary.length >= 8 ? 0.15 : 0) +
      (segments.length === 1 ? 0.08 : 0)
  )

  return { productName, coreTokens: tokens, confidence }
}

export function buildListingProductContext(
  title: string,
  options?: { description?: string; bullets?: string[] }
): ListingProductContext & { descriptionExcluded: boolean } {
  const t = title.trim()
  const { hints, descriptionExcluded } = buildSupplierHintsForCategory(
    t,
    options?.description,
    options?.bullets
  )
  const { productName, coreTokens, confidence } = extractProductIdentityFromTitle(t)
  const classificationFocus = productName.length >= 3 ? productName : t

  return {
    title: t,
    supplierHints: hints,
    productName,
    coreTokens,
    classificationFocus,
    nameConfidence: confidence,
    descriptionExcluded,
  }
}

export function listingProductInsight(
  ctx: ListingProductContext & { descriptionExcluded?: boolean }
): ListingProductInsight | null {
  if (ctx.title.length < 3) return null
  const name = ctx.productName || ctx.title
  const base =
    ctx.productName.length >= 3 && ctx.productName !== ctx.title
      ? `Analyse centrée sur « ${name} » (nom extrait du titre)`
      : `Analyse centrée sur le titre : « ${ctx.title.slice(0, 72)}${ctx.title.length > 72 ? "…" : ""} »`

  return {
    productName: name,
    focusLabel: ctx.descriptionExcluded
      ? `${base} — description marketing exclue (ne modifie pas les suggestions)`
      : base,
    descriptionExcluded: Boolean(ctx.descriptionExcluded),
  }
}

/** Title-only score — description/hints never inflate unrelated categories. */
export function scoreListingContextAgainstBreadcrumb(
  ctx: ListingProductContext,
  breadcrumb: string
): number {
  const focusScore = scoreProductTextAgainstBreadcrumb(ctx.classificationFocus, breadcrumb)
  const rawTitleScore =
    ctx.classificationFocus !== ctx.title
      ? scoreProductTextAgainstBreadcrumb(ctx.title, breadcrumb) * 0.25
      : 0

  let hintBoost = 0
  if (ctx.supplierHints.trim()) {
    const hintScore = scoreProductTextAgainstBreadcrumb(ctx.supplierHints, breadcrumb)
    if (hintScore >= 7 && focusScore >= 5) {
      hintBoost = Math.min(hintScore * 0.08, 2.5)
    }
  }

  return focusScore + rawTitleScore + hintBoost
}

/** Text used for viability — title identity only, never full description. */
export function listingViabilityText(ctx: ListingProductContext): string {
  return ctx.classificationFocus.trim() || ctx.title.trim()
}

export function formatListingContextForAi(ctx: ListingProductContext): string {
  const lines = [
    "═══ PRIORITÉ ABSOLUE — TITRE / NOM PRODUIT ═══",
    `Titre listing: ${ctx.title}`,
    `Nom produit à classer: ${ctx.productName || ctx.title}`,
    ctx.coreTokens.length ? `Mots-clés produit (titre): ${ctx.coreTokens.join(", ")}` : null,
    "",
    "═══ INDICES FOURNISSEUR (optionnels, confirmation seulement) ═══",
    ctx.supplierHints.trim() ||
      "(aucun — classer UNIQUEMENT d'après le titre / nom produit)",
    "",
    "═══ INTERDICTIONS ═══",
    "- NE PAS classer d'après un texte marketing long (description SEO, storytelling).",
    "- NE PAS confondre accessoire et produit (ex. moustiquaire + bande adhésive → moustiquaire, PAS colles).",
    "- NE PAS confondre matériau/mécanisme et produit (magnétique/adhésif ≠ catégorie colles).",
    "- Le TYPE DE PRODUIT du titre prime toujours sur tout le reste.",
  ]
  return lines.filter((l) => l != null).join("\n")
}

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

  const mosquitoLike =
    /\b(moustiquaire|moustiquaires|mosquito|insect\s*screen|rideau\s*anti.?insect)\b/i.test(focus) ||
    tokens.some((t) => /moustiquaire|mosquito/.test(t))
  if (mosquitoLike) {
    if (
      /\b(colle|colles|adhesif|adhesifs|aimant|arts?\s*et\s*loisirs|artisanat|aquarium|poisson|entretien\s+d.?aquarium|bande\s+thermocoll|thermocollant)\b/i.test(
        b
      )
    ) {
      return true
    }
  }

  for (const ex of aiExcludes) {
    const e = ex.trim().toLowerCase()
    if (e.length >= 4 && b.includes(e)) return true
  }

  return false
}

/** Reject categories that score high only on description noise, not on title. */
export function categoryOnlyMatchesDescriptionNoise(
  ctx: ListingProductContext,
  breadcrumb: string
): boolean {
  const titleScore = scoreProductTextAgainstBreadcrumb(ctx.classificationFocus, breadcrumb)
  if (titleScore >= 6) return false

  if (!ctx.supplierHints.trim()) return titleScore < 4

  const hintScore = scoreProductTextAgainstBreadcrumb(ctx.supplierHints, breadcrumb)
  const focusScore = scoreListingContextAgainstBreadcrumb(ctx, breadcrumb)

  return hintScore > titleScore + 4 && focusScore < 7
}
