/**
 * In-store product search — pure ranking over the products a storefront already shows. No database, no network.
 *
 *   • accent- and case-insensitive ("cafe" finds "Café"), punctuation ignored;
 *   • every word of the query must match (AND), so "black leggings" narrows instead of widening;
 *   • ranked: name starts with the word › a word of the name starts with it › appears inside › only the category matches.
 */
export type SearchableProduct = {
  listingId: string
  name: string
  priceCents: number
  imageUrl: string | null
  category?: string | null
}

export const SEARCH_MIN_CHARS = 2
export const SEARCH_MAX_QUERY_CHARS = 80

/** lowercase, accents stripped, anything that is not a letter/number/CJK becomes a single space. */
export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function scoreToken(nameWords: string[], name: string, category: string, token: string): number {
  if (nameWords[0]?.startsWith(token)) return 4
  if (nameWords.some((w) => w.startsWith(token))) return 3
  if (name.includes(token)) return 2
  if (category.includes(token)) return 1
  return 0
}

export function searchStoreProducts(products: readonly SearchableProduct[], query: string, limit = 8): SearchableProduct[] {
  const tokens = normalizeSearchText(query.slice(0, SEARCH_MAX_QUERY_CHARS)).split(" ").filter(Boolean)
  if (tokens.length === 0 || normalizeSearchText(query).length < SEARCH_MIN_CHARS) return []

  const scored: { product: SearchableProduct; score: number }[] = []
  for (const product of products) {
    const name = normalizeSearchText(product.name)
    const category = normalizeSearchText(product.category ?? "")
    const nameWords = name.split(" ")
    let total = 0
    let matchedAll = true
    for (const token of tokens) {
      const s = scoreToken(nameWords, name, category, token)
      if (s === 0) {
        matchedAll = false
        break
      }
      total += s
    }
    if (matchedAll) scored.push({ product, score: total })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, Math.max(0, limit))
    .map((s) => s.product)
}
