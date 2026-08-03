/**
 * Client-safe affiliate catalog list filters (URL params).
 * Server applies them in `@/lib/affiliate-catalog-query`.
 */

export type CatalogVitrineFilter = "all" | "hors" | "en"
export type CatalogAddedWindow = "all" | "7d" | "30d" | "90d"

const MS_DAY = 24 * 60 * 60 * 1000

export function parseCatalogVitrineFilter(raw: string | null | undefined): CatalogVitrineFilter {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "hors" || v === "out" || v === "none") return "hors"
  if (v === "en" || v === "in" || v === "live") return "en"
  return "all"
}

export function parseCatalogAddedWindow(raw: string | null | undefined): CatalogAddedWindow {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "7d" || v === "7") return "7d"
  if (v === "30d" || v === "30") return "30d"
  if (v === "90d" || v === "90") return "90d"
  return "all"
}

/** Oldest `createdAt` allowed for the selected window, or null = no date filter. */
export function catalogAddedSinceDate(
  window: CatalogAddedWindow,
  nowMs: number = Date.now()
): Date | null {
  if (window === "all") return null
  const days = window === "7d" ? 7 : window === "30d" ? 30 : 90
  return new Date(nowMs - days * MS_DAY)
}

export function catalogAddedWindowLabel(window: CatalogAddedWindow): string {
  if (window === "7d") return "7 j"
  if (window === "30d") return "30 j"
  if (window === "90d") return "90 j"
  return "Tous"
}
