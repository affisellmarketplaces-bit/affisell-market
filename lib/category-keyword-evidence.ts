/**
 * Evidence check for the keyword (non-AI) category engine.
 *
 * The keyword scorer is lexical and forgiving (5-letter prefixes, ancestors count): an English AliExpress title
 * such as "Marvel Spider Man Articulated Action Figure Collectible … Collection" scored highest on
 * "Arts et loisirs > Articles de collection > … > Articles de football dédicacés" because "articulated" ≈ "articles"
 * and "collectible"/"collection" ≈ "collection". Nothing in that breadcrumb names the product.
 *
 * Rule enforced here: a keyword suggestion is only trustworthy when a SPECIFIC word of the title (not marketing
 * filler) is, strictly, a word of the category's own name or its parent. Otherwise it is dropped — showing nothing
 * is better than showing a wrong category.
 */

/** Marketing / audience / filler words present in most marketplace titles AND in many category names. */
export const GENERIC_TITLE_TOKENS = new Set([
  "collection", "collections", "collectible", "collectibles", "collectionneur", "collector", "collectors",
  "adult", "adults", "adulte", "adultes", "kid", "kids", "child", "children", "enfant", "enfants", "baby",
  "men", "man", "mens", "women", "woman", "womens", "homme", "hommes", "femme", "femmes", "unisex", "boy", "boys", "girl", "girls",
  "home", "house", "desktop", "office", "bureau", "maison", "decoration", "decorations", "decor", "decorative", "deco",
  "gift", "gifts", "cadeau", "cadeaux", "present", "premium", "quality", "qualite", "high", "best", "hot", "sale",
  "style", "fashion", "version", "edition", "original", "official", "officiel", "authentic", "genuine", "brand", "design", "designer",
  "series", "serie", "model", "modele", "type", "size", "taille", "color", "colour", "colors", "couleur", "couleurs", "multi",
  "universal", "universel", "portable", "mini", "large", "small", "medium", "big", "super", "ultra", "pro", "plus", "max", "lite",
  "set", "kit", "pack", "lot", "pcs", "piece", "pieces", "free", "shipping", "livraison", "gratuite", "with", "for", "and", "the",
  "avec", "pour", "sans", "dans", "new", "nouveau", "nouvelle", "2023", "2024", "2025", "2026",
  "article", "articles", "accessoire", "accessoires", "accessories", "accessory", "product", "products", "produit", "produits",
  "item", "items", "wholesale", "dropshipping", "factory", "custom", "customized", "personnalise",
])

/** English product nouns → French taxonomy words (the taxonomy is French; AliExpress titles are English). */
const EN_FR_TERMS: Array<[RegExp, string]> = [
  [/\b(?:action|anime|movie|collectible|marvel|pvc|model)\s+figures?\b/i, "figurine figurines jouet"],
  [/\bfigurines?\b/i, "figurine figurines"],
  [/\b(?:toys?|jouets?)\b/i, "jouet jouets"],
  [/\bplush(?:ie|ies|es)?\b|\bstuffed\s+animals?\b/i, "peluche peluches"],
  [/\bsmart\s*watch(?:es)?\b/i, "montre connectee montres connectees"],
  [/\bwrist\s*watch(?:es)?\b|\bwatch(?:es)?\b/i, "montre montres"],
  [/\bheadphones?\b|\bheadsets?\b/i, "casque casques ecouteurs"],
  [/\bearbuds?\b|\bearphones?\b|\btws\b/i, "ecouteurs"],
  [/\b(?:bluetooth\s+)?speakers?\b/i, "enceinte enceintes haut-parleur"],
  [/\bphone\s+cases?\b|\bcases?\s+for\s+(?:iphone|samsung|phone)\b/i, "coque etui telephone"],
  [/\bchargers?\b/i, "chargeur chargeurs"],
  [/\bcables?\b/i, "cable cables"],
  [/\bpower\s*banks?\b/i, "batterie externe"],
  [/\bbackpacks?\b/i, "sac a dos"],
  [/\bwallets?\b/i, "portefeuille portefeuilles"],
  [/\bnecklaces?\b/i, "collier colliers"],
  [/\brings?\b/i, "bague bagues"],
  [/\bearrings?\b/i, "boucles d'oreilles"],
  [/\bbracelets?\b/i, "bracelet bracelets"],
  [/\bdress(?:es)?\b/i, "robe robes"],
  [/\bsneakers?\b|\bshoes?\b/i, "chaussures baskets"],
  [/\bsunglasses\b/i, "lunettes de soleil"],
  [/\bled\s+(?:strip|lights?|lamps?)\b/i, "ruban led guirlande lampe"],
  [/\bdesk\s+lamps?\b|\btable\s+lamps?\b/i, "lampe lampes"],
  [/\bfans?\b/i, "ventilateur ventilateurs"],
  [/\bmasks?\b/i, "masque masques"],
  [/\bkeyboards?\b/i, "clavier claviers"],
  [/\bmouse\b|\bmice\b/i, "souris"],
  [/\bcameras?\b/i, "camera cameras appareil photo"],
  [/\bdrones?\b/i, "drone drones"],
  [/\bblankets?\b/i, "couverture plaid"],
  [/\bpillows?\b|\bcushions?\b/i, "oreiller coussin"],
  [/\bcurtains?\b/i, "rideau rideaux"],
  [/\bpuzzles?\b/i, "puzzle puzzles"],
  [/\bfishing\b/i, "peche"],
  [/\bpet\s+(?:bed|toy|collar|leash)s?\b|\bdog\s+(?:collar|leash|toy|bed)s?\b/i, "animaux chien chat"],
]

/** Appends French equivalents of recognised English product nouns, leaving the original text intact. */
export function expandEnglishProductTerms(text: string): string {
  const extra: string[] = []
  for (const [rx, fr] of EN_FR_TERMS) {
    if (rx.test(text)) extra.push(fr)
  }
  return extra.length > 0 ? `${text} ${extra.join(" ")}` : text
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/** Plural-insensitive stem (ventilateurs → ventilateur, bijoux → bijou, chevaux kept as is). */
function stem(w: string): string {
  if (w.length >= 5 && w.endsWith("eaux")) return w.slice(0, -1)
  if (w.length >= 4 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1)
  if (w.length >= 4 && w.endsWith("x")) return w.slice(0, -1)
  return w
}

function words(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
}

/** Title words that can actually name a product type (generic filler and short noise removed). */
export function specificTitleTokens(text: string): string[] {
  const out = new Set<string>()
  for (const w of words(expandEnglishProductTerms(text))) {
    if (w.length < 4 || GENERIC_TITLE_TOKENS.has(w) || GENERIC_TITLE_TOKENS.has(stem(w))) continue
    out.add(stem(w))
  }
  return [...out]
}

/**
 * True when a specific title word is, strictly (same stem — no prefix guessing), a word of the leaf name or of its
 * direct parent. Ancestors higher in the path never count: "Articles de collection" must not vouch for a leaf.
 */
export function categoryHasSpecificEvidence(text: string, breadcrumb: string): boolean {
  const tokens = specificTitleTokens(text)
  if (tokens.length === 0) return false
  const segments = breadcrumb.split(">").map((s) => s.trim()).filter(Boolean)
  const own = new Set(
    words(segments.slice(-2).join(" "))
      .filter((w) => w.length >= 4 && !GENERIC_TITLE_TOKENS.has(w))
      .map(stem)
  )
  return tokens.some((t) => own.has(t))
}

export function filterByKeywordEvidence<T extends { breadcrumb: string }>(text: string, items: T[]): T[] {
  return items.filter((it) => categoryHasSpecificEvidence(text, it.breadcrumb))
}
