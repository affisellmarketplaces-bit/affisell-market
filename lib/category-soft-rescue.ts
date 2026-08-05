import type { LeafPath } from "@/lib/category-browse"
import {
  extractProductTitleTokens,
  isCategorySuggestionViable,
  scoreProductTextAgainstBreadcrumb,
  suggestLeafCategoriesFromProductText,
  wordMatchesInBreadcrumb,
} from "@/lib/category-title-match"
import {
  breadcrumbConflictsWithIdentity,
  type ListingProductContext,
} from "@/lib/listing-product-signal"

/** Soft floor — only used when primary suggest returns nothing and title has product signal. */
export const SOFT_RESCUE_MIN_SCORE = 4

const WEAK_RESCUE_TOKENS = new Set([
  "connect",
  "connected",
  "sommeil",
  "sleep",
  "smart",
  "band",
  "pro",
  "max",
  "mini",
  "lite",
  "plus",
  "noir",
  "black",
  "white",
  "bleu",
  "red",
  "new",
  "pack",
  "set",
  "kit",
  "lot",
  "pcs",
  "usb",
  "led",
  "pour",
  "avec",
  "sans",
  "fil",
])

/**
 * True when the listing has enough commercial signal to justify a soft category
 * suggestion rather than leaving the supplier with an empty picker.
 */
export function hasSoftRescueSignal(ctx: ListingProductContext): boolean {
  const tokens = [
    ...ctx.coreTokens,
    ...extractProductTitleTokens(ctx.classificationFocus || ctx.title),
  ]
  const strong = tokens.filter((t) => t.length >= 4 && !WEAK_RESCUE_TOKENS.has(t))
  if (strong.length >= 1) return true
  /** Short product head nouns (sac, dos, led…) still count when paired with another token. */
  const shortHeads = tokens.filter(
    (t) => t.length >= 3 && t.length < 4 && !WEAK_RESCUE_TOKENS.has(t)
  )
  return strong.length + shortHeads.length >= 2
}

function strongTokensForRescue(ctx: ListingProductContext): string[] {
  const raw = [
    ...ctx.coreTokens,
    ...extractProductTitleTokens(ctx.classificationFocus || ctx.title),
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of raw) {
    const w = t.trim().toLowerCase()
    if (w.length < 3 || WEAK_RESCUE_TOKENS.has(w) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

function breadcrumbSharesStrongToken(breadcrumb: string, tokens: string[]): boolean {
  return tokens.some((t) => wordMatchesInBreadcrumb(t, breadcrumb))
}

/**
 * Last-resort category picks when strict scoring (min 7) returns nothing.
 * Never invents across domains: requires token overlap + identity conflict checks.
 * Confidence must stay low enough that auto-apply stays off.
 */
export function softRescueCategorySuggestions(
  ctx: ListingProductContext,
  leafPaths: LeafPath[],
  limit = 3
): LeafPath[] {
  if (!hasSoftRescueSignal(ctx) || leafPaths.length === 0) return []

  const focus = ctx.classificationFocus.trim() || ctx.title.trim()
  const strongTokens = strongTokensForRescue(ctx)
  if (strongTokens.length === 0) return []

  /** Prefer primary scorer at soft floor first. */
  const primarySoft = suggestLeafCategoriesFromProductText(focus, ctx.supplierHints, leafPaths, limit, {
    minScore: SOFT_RESCUE_MIN_SCORE,
  })

  const candidates =
    primarySoft.length > 0
      ? primarySoft
      : leafPaths
          .map((lp) => ({
            lp,
            s: scoreProductTextAgainstBreadcrumb(focus, lp.breadcrumb),
          }))
          .filter(({ s, lp }) => {
            if (s < SOFT_RESCUE_MIN_SCORE) return false
            if (!breadcrumbSharesStrongToken(lp.breadcrumb, strongTokens)) return false
            return true
          })
          .sort((a, b) => b.s - a.s)
          .map(({ lp }) => lp)

  const out: LeafPath[] = []
  const seen = new Set<string>()
  for (const lp of candidates) {
    if (out.length >= limit) break
    if (seen.has(lp.leafId)) continue
    if (breadcrumbConflictsWithIdentity(ctx, lp.breadcrumb)) continue
    if (!isCategorySuggestionViable(focus, lp.breadcrumb, SOFT_RESCUE_MIN_SCORE)) continue
    if (!breadcrumbSharesStrongToken(lp.breadcrumb, strongTokens)) continue
    seen.add(lp.leafId)
    out.push(lp)
  }

  return out
}
