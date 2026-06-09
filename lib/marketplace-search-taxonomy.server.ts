import { googleTaxonomyNameMap } from "@/lib/google-taxonomy-locale"

/**
 * FR↔EN bridge for buyer search: a query like « stylo » must find products
 * titled in English (« Ballpoint Pens ») and vice versa. We match query tokens
 * against Google taxonomy leaf names in both locales, then emit the words of
 * the matching names in BOTH languages as extra search terms.
 */

const BRIDGE_LOCALES = ["fr", "en"] as const

const BRIDGE_STOPWORDS = new Set([
  "les", "des", "pour", "avec", "and", "the", "for", "with",
  "autres", "other", "tous", "all", "non", "sans",
  "accessoires", "accessories", "fournitures", "supplies", "articles", "equipement",
])

const MAX_MATCHED_TAXONOMY_NODES = 25
const MAX_BRIDGE_TERMS = 10

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function nameWords(name: string): string[] {
  return name
    .split(/[^\p{L}0-9]+/u)
    .map(normalizeToken)
    .filter((w) => w.length >= 3)
}

/** Exact word match (singular ↔ plural only): avoids « pens » matching « dispensers ». */
function tokenMatchesWords(token: string, words: string[]): boolean {
  for (const w of words) {
    if (w === token) return true
    if (w === `${token}s` || token === `${w}s`) return true
  }
  return false
}

/** Raw query tokens only — synonym expansion is too broad for taxonomy matching. */
function rawQueryTokens(rawQuery: string): string[] {
  return rawQuery
    .split(/[^a-zA-Z0-9àâäéèêëïîôùûüç'+]+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 3)
}

/** Extra search terms (both languages) derived from taxonomy names matching the query. */
export function taxonomyBridgeTerms(rawQuery: string, max = MAX_BRIDGE_TERMS): string[] {
  const tokens = rawQueryTokens(rawQuery)
  if (tokens.length === 0) return []

  // locale where the token matched → emit words from the OTHER locale (the translation)
  const matchedIdsByLocale = new Map<(typeof BRIDGE_LOCALES)[number], Set<number>>()
  for (const locale of BRIDGE_LOCALES) {
    const matched = new Set<number>()
    for (const [googleId, name] of googleTaxonomyNameMap(locale)) {
      if (matched.size >= MAX_MATCHED_TAXONOMY_NODES) break
      const words = nameWords(name)
      if (tokens.some((t) => tokenMatchesWords(t, words))) matched.add(googleId)
    }
    matchedIdsByLocale.set(locale, matched)
  }

  const queryTokenSet = new Set(tokens)
  const out: string[] = []
  const seen = new Set<string>()

  const pushTerm = (word: string) => {
    const norm = normalizeToken(word)
    if (norm.length < 3 || BRIDGE_STOPWORDS.has(norm) || queryTokenSet.has(norm)) return
    if (seen.has(norm)) return
    seen.add(norm)
    out.push(word)
    if (word.endsWith("s")) {
      const singular = word.slice(0, -1)
      const singularNorm = normalizeToken(singular)
      if (singularNorm.length >= 3 && !seen.has(singularNorm)) {
        seen.add(singularNorm)
        out.push(singular)
      }
    }
  }

  for (const matchLocale of BRIDGE_LOCALES) {
    const otherLocale = matchLocale === "fr" ? "en" : "fr"
    for (const googleId of matchedIdsByLocale.get(matchLocale) ?? []) {
      const translated = googleTaxonomyNameMap(otherLocale).get(googleId)
      if (!translated) continue
      for (const word of translated.split(/[^\p{L}0-9]+/u)) {
        if (out.length >= max) return out
        pushTerm(word.trim())
      }
    }
  }

  return out
}
