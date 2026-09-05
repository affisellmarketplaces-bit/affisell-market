/** Buyer catalog chrome — hide aisle groups or dock the category column. */

export const CATALOG_CATEGORY_CHROME_STORAGE_KEY = "affisell.catalog.categoryChrome.v1"

export type CatalogCategoryChrome = {
  /** Entire left category + filter column collapsed → product cinema. */
  docked: boolean
  /** One flag per aisle tier (up to 3). true = that group is hidden. */
  collapsedTiers: [boolean, boolean, boolean]
}

export const DEFAULT_CATALOG_CATEGORY_CHROME: CatalogCategoryChrome = {
  docked: false,
  collapsedTiers: [false, false, false],
}

function asBool(value: unknown): boolean {
  return value === true
}

export function parseCatalogCategoryChrome(raw: string | null | undefined): CatalogCategoryChrome {
  if (!raw?.trim()) return { ...DEFAULT_CATALOG_CATEGORY_CHROME, collapsedTiers: [...DEFAULT_CATALOG_CATEGORY_CHROME.collapsedTiers] }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_CATALOG_CATEGORY_CHROME, collapsedTiers: [...DEFAULT_CATALOG_CATEGORY_CHROME.collapsedTiers] }
    }
    const rec = parsed as Record<string, unknown>
    const tiersRaw = Array.isArray(rec.collapsedTiers) ? rec.collapsedTiers : []
    const collapsedTiers: [boolean, boolean, boolean] = [
      asBool(tiersRaw[0]),
      asBool(tiersRaw[1]),
      asBool(tiersRaw[2]),
    ]
    return {
      docked: asBool(rec.docked),
      collapsedTiers,
    }
  } catch {
    return { ...DEFAULT_CATALOG_CATEGORY_CHROME, collapsedTiers: [...DEFAULT_CATALOG_CATEGORY_CHROME.collapsedTiers] }
  }
}

export function toggleCollapsedTier(
  collapsedTiers: readonly boolean[],
  index: number
): [boolean, boolean, boolean] {
  const next: [boolean, boolean, boolean] = [
    collapsedTiers[0] === true,
    collapsedTiers[1] === true,
    collapsedTiers[2] === true,
  ]
  if (index < 0 || index > 2) return next
  next[index] = !next[index]
  return next
}

export function collapseAllTiers(): [boolean, boolean, boolean] {
  return [true, true, true]
}

export function expandAllTiers(): [boolean, boolean, boolean] {
  return [false, false, false]
}

export function allTiersCollapsed(collapsedTiers: readonly boolean[], tierCount: number): boolean {
  if (tierCount <= 0) return true
  const n = Math.min(3, tierCount)
  for (let i = 0; i < n; i++) {
    if (!collapsedTiers[i]) return false
  }
  return true
}

export function readCatalogCategoryChrome(): CatalogCategoryChrome {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CATALOG_CATEGORY_CHROME, collapsedTiers: [...DEFAULT_CATALOG_CATEGORY_CHROME.collapsedTiers] }
  }
  try {
    return parseCatalogCategoryChrome(window.localStorage.getItem(CATALOG_CATEGORY_CHROME_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_CATALOG_CATEGORY_CHROME, collapsedTiers: [...DEFAULT_CATALOG_CATEGORY_CHROME.collapsedTiers] }
  }
}

export function writeCatalogCategoryChrome(state: CatalogCategoryChrome): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CATALOG_CATEGORY_CHROME_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}
