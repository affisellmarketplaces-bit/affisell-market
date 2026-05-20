/** Subsequence fuzzy score (higher = better). Used by Command K navigation search. */
export function fuzzyScore(needle: string, haystack: string): number {
  const n = needle.trim().toLowerCase()
  const h = haystack.toLowerCase()
  if (!n) return 1
  if (h === n) return 1000
  if (h.startsWith(n)) return 800 + (n.length / h.length) * 100
  if (h.includes(n)) return 500 + (n.length / h.length) * 50

  let ni = 0
  let consecutive = 0
  let maxConsecutive = 0
  let firstIdx = -1

  for (let hi = 0; hi < h.length && ni < n.length; hi++) {
    if (h[hi] === n[ni]) {
      if (firstIdx < 0) firstIdx = hi
      ni++
      consecutive++
      maxConsecutive = Math.max(maxConsecutive, consecutive)
    } else {
      consecutive = 0
    }
  }

  if (ni !== n.length) return 0
  const spread = h.length - firstIdx
  return 200 + maxConsecutive * 20 - spread * 2
}

export function rankByFuzzy<T>(
  items: T[],
  query: string,
  getSearchable: (item: T) => string
): Array<T & { fuzzyRank: number }> {
  const q = query.trim()
  if (!q) {
    return items.map((item) => ({ ...item, fuzzyRank: 1 }))
  }
  return items
    .map((item) => ({
      ...item,
      fuzzyRank: fuzzyScore(q, getSearchable(item)),
    }))
    .filter((item) => item.fuzzyRank > 0)
    .sort((a, b) => b.fuzzyRank - a.fuzzyRank)
}
