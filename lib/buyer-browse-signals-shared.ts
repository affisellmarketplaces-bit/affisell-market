/** Browse category names — safe for `"use client"`. */

export const BUYER_BROWSE_SIGNALS_COOKIE = "affisell_browse_signals"
export const BUYER_BROWSE_SIGNALS_MAX = 6

export function parseBrowseSignalsCookie(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of parsed) {
      if (typeof item !== "string") continue
      const name = item.trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      out.push(name)
      if (out.length >= BUYER_BROWSE_SIGNALS_MAX) break
    }
    return out
  } catch {
    return []
  }
}

export function mergeBrowseSignalCategories(
  existing: string[],
  nextName: string
): string[] {
  const name = nextName.trim()
  if (!name) return existing
  const lower = name.toLowerCase()
  const rest = existing.filter((c) => c.toLowerCase() !== lower)
  return [name, ...rest].slice(0, BUYER_BROWSE_SIGNALS_MAX)
}

export function collectCategoryHints(args: {
  productCategoryLists: string[][]
  browseCategoryNames: string[]
}): string[] {
  const scores = new Map<string, number>()

  for (const name of args.browseCategoryNames) {
    const key = name.trim()
    if (!key) continue
    scores.set(key.toLowerCase(), (scores.get(key.toLowerCase()) ?? 0) + 3)
  }

  for (const list of args.productCategoryLists) {
    for (const raw of list) {
      const key = raw.trim()
      if (!key) continue
      scores.set(key.toLowerCase(), (scores.get(key.toLowerCase()) ?? 0) + 1)
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lower]) => {
      for (const list of args.productCategoryLists) {
        for (const raw of list) {
          if (raw.trim().toLowerCase() === lower) return raw.trim()
        }
      }
      for (const name of args.browseCategoryNames) {
        if (name.trim().toLowerCase() === lower) return name.trim()
      }
      return lower
    })
    .slice(0, 8)
}
