/**
 * Buyer marketplace search: synonym expansion + relevance scoring (pg_trgm-friendly).
 */

export type MarketplaceSearchHit = {
  listingId: string
  score: number
}

/** FR/EN retail synonyms → extra terms for matching. */
const SEARCH_SYNONYM_GROUPS: string[][] = [
  ["telephone", "telephones", "mobile", "mobiles", "smartphone", "smartphones", "iphone", "android"],
  ["montre", "montres", "bracelet", "connecte", "connectee", "smartband", "fitness", "tracker"],
  ["trottinette", "trottinettes", "scooter", "escooter", "patinette"],
  ["legging", "leggings", "collant", "collants", "yoga"],
  ["camera", "caméra", "dashcam", "dash", "gopro", "recul"],
  ["masque", "masques", "ffp2", "respirateur"],
  ["commode", "meuble", "rangement", "buffet"],
  ["ventilateur", "fan", "brumisateur", "climatisation"],
  ["casque", "ecouteurs", "earbuds", "airpods", "headphones"],
  ["ordinateur", "laptop", "macbook", "pc", "portable"],
]

function normalizeSearchToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

/** Unique normalized terms: query tokens + synonym group expansions. */
export function expandMarketplaceSearchTerms(rawQuery: string): string[] {
  const q = rawQuery.trim()
  if (!q) return []

  const tokens = q
    .split(/[^a-zA-Z0-9àâäéèêëïîôùûüç'+]+/)
    .map(normalizeSearchToken)
    .filter((t) => t.length >= 2)

  const out = new Set<string>(tokens)
  if (tokens.length === 0 && q.length >= 2) {
    out.add(normalizeSearchToken(q))
  }

  for (const token of [...out]) {
    for (const group of SEARCH_SYNONYM_GROUPS) {
      const normalizedGroup = group.map(normalizeSearchToken)
      if (normalizedGroup.some((g) => g === token || (g.length >= 4 && token.startsWith(g.slice(0, 4))))) {
        for (const g of normalizedGroup) {
          if (g.length >= 3) out.add(g)
        }
      }
    }
  }

  return [...out]
}

function termInText(term: string, text: string): boolean {
  const t = normalizeSearchToken(term)
  const hay = normalizeSearchToken(text)
  if (!t || !hay) return false
  if (hay.includes(t)) return true
  if (t.length >= 5 && hay.includes(t.slice(0, 5))) return true
  return false
}

export type ListingSearchDocument = {
  listingId: string
  title: string
  description: string
  categoryPath: string
  isFeatured: boolean
  conversions: number
  clicks: number
}

/** Score a listing against expanded search terms (higher = better). */
export function scoreListingSearchMatch(doc: ListingSearchDocument, rawQuery: string): number {
  const terms = expandMarketplaceSearchTerms(rawQuery)
  if (terms.length === 0) return 0

  const blob = `${doc.title} ${doc.description} ${doc.categoryPath}`
  let matched = 0
  let titleHits = 0

  for (const term of terms) {
    if (termInText(term, blob)) matched += 1
    if (termInText(term, doc.title)) titleHits += 1
  }

  if (matched === 0) return 0

  const coverage = matched / terms.length
  let score = coverage * 40 + titleHits * 12

  const qNorm = normalizeSearchToken(rawQuery)
  if (qNorm.length >= 3 && normalizeSearchToken(doc.title).includes(qNorm)) {
    score += 25
  }

  if (doc.isFeatured) score += 8
  score += Math.min(doc.conversions, 200) * 0.15
  score += Math.min(doc.clicks, 500) * 0.02

  return score
}

export function rankListingSearchHits(
  docs: ListingSearchDocument[],
  rawQuery: string,
  limit: number,
  extraTerms: string[] = []
): MarketplaceSearchHit[] {
  const minScore = 6
  const scored = docs
    .map((doc) => {
      let score = scoreListingSearchMatch(doc, rawQuery)
      // Cross-language rescue: taxonomy bridge terms (e.g. stylo → Pens)
      // count as matches without diluting the main coverage score.
      if (score < minScore && extraTerms.length > 0) {
        const blob = `${doc.title} ${doc.description} ${doc.categoryPath}`
        let matchedExtra = 0
        let extraTitleHits = 0
        for (const term of extraTerms) {
          if (termInText(term, blob)) matchedExtra += 1
          if (termInText(term, doc.title)) extraTitleHits += 1
        }
        if (matchedExtra > 0) {
          score =
            minScore +
            matchedExtra * 2 +
            extraTitleHits * 6 +
            (doc.isFeatured ? 4 : 0) +
            Math.min(doc.conversions, 200) * 0.1
        }
      }
      return { listingId: doc.listingId, score }
    })
    .filter((h) => h.score >= minScore)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}
