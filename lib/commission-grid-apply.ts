import {
  COMMISSION_GRID_MAP,
  type CommissionGridEntry,
} from "@/lib/commission-grid-config"
import {
  loadTaxonomyEnRows,
  type TaxonomyEnRow,
} from "@/lib/commission-grid-taxonomy"
import { DEFAULT_AFFISELL_COMMISSION_BPS } from "@/lib/affisell-platform-commission"
import { DEFAULT_SUPPLIER_COMMISSION_BPS } from "@/lib/supplier-commission-rate"

export type CategoryCommissionTarget = {
  id: string
  googleId: number | null
  fullPath: string
  currentBps: number | null
  targetBps: number
}

type GridMatch = {
  bps: number
  specificity: number
  entryIndex: number
}

const GRID_ENTRIES = Object.entries(COMMISSION_GRID_MAP)

/** Affisell-only leaves beat any Google slug prefix match. */
const EXTENSION_MATCH_SPECIFICITY = 10_000

export function buildGoogleIdToSlugPath(taxonomy: TaxonomyEnRow[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const row of taxonomy) {
    map.set(row.googleId, row.slugPath)
  }
  return map
}

export function resolveGridBpsForCategory(input: {
  googleId: number | null
  fullPath: string
  googleIdToSlugPath: Map<number, string>
  entries?: readonly (readonly [string, CommissionGridEntry])[]
  pickBps: (entry: CommissionGridEntry) => number
  defaultBps: number
}): number {
  const entries = input.entries ?? GRID_ENTRIES
  const googleSlugPath =
    input.googleId != null ? input.googleIdToSlugPath.get(input.googleId) ?? null : null

  let best: GridMatch | null = null

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const [, entry] = entries[entryIndex]!

    for (const extensionPath of entry.affisellFullPaths) {
      if (input.fullPath !== extensionPath) continue
      const candidate: GridMatch = {
        bps: input.pickBps(entry),
        specificity: EXTENSION_MATCH_SPECIFICITY,
        entryIndex,
      }
      if (shouldReplaceMatch(best, candidate)) best = candidate
    }

    if (!googleSlugPath) continue

    for (const slug of entry.googleSlugs) {
      const normalized = slug.trim().toLowerCase()
      if (
        googleSlugPath !== normalized &&
        !googleSlugPath.startsWith(`${normalized} > `)
      ) {
        continue
      }
      const candidate: GridMatch = {
        bps: input.pickBps(entry),
        specificity: normalized.length,
        entryIndex,
      }
      if (shouldReplaceMatch(best, candidate)) best = candidate
    }
  }

  return best?.bps ?? input.defaultBps
}

export function resolveGridAffisellBpsForCategory(input: {
  googleId: number | null
  fullPath: string
  googleIdToSlugPath: Map<number, string>
  entries?: readonly (readonly [string, CommissionGridEntry])[]
}): number {
  return resolveGridBpsForCategory({
    ...input,
    pickBps: (entry) => entry.affisellBps,
    defaultBps: DEFAULT_AFFISELL_COMMISSION_BPS,
  })
}

export function resolveGridSupplierBpsForCategory(input: {
  googleId: number | null
  fullPath: string
  googleIdToSlugPath: Map<number, string>
  entries?: readonly (readonly [string, CommissionGridEntry])[]
}): number {
  return resolveGridBpsForCategory({
    ...input,
    pickBps: (entry) => entry.supplierBps,
    defaultBps: DEFAULT_SUPPLIER_COMMISSION_BPS,
  })
}

function shouldReplaceMatch(current: GridMatch | null, candidate: GridMatch): boolean {
  if (!current) return true
  if (candidate.specificity > current.specificity) return true
  if (candidate.specificity < current.specificity) return false
  return candidate.entryIndex > current.entryIndex
}

function buildCategoryBpsPlan<
  T extends {
    id: string
    googleId: number | null
    fullPath: string
  },
>(
  categories: ReadonlyArray<T>,
  resolveTarget: (category: T, googleIdToSlugPath: Map<number, string>) => number,
  readCurrent: (category: T) => number | null,
  taxonomy?: TaxonomyEnRow[]
): CategoryCommissionTarget[] {
  const googleIdToSlugPath = buildGoogleIdToSlugPath(taxonomy ?? loadTaxonomyEnRows())

  return categories.map((category) => ({
    id: category.id,
    googleId: category.googleId,
    fullPath: category.fullPath,
    currentBps: readCurrent(category),
    targetBps: resolveTarget(category, googleIdToSlugPath),
  }))
}

export function buildCategoryAffisellBpsPlan(
  categories: ReadonlyArray<{
    id: string
    googleId: number | null
    fullPath: string
    affisellCommissionRateBps: number | null
  }>,
  taxonomy?: TaxonomyEnRow[]
): CategoryCommissionTarget[] {
  return buildCategoryBpsPlan(
    categories,
    (category, googleIdToSlugPath) =>
      resolveGridAffisellBpsForCategory({
        googleId: category.googleId,
        fullPath: category.fullPath,
        googleIdToSlugPath,
      }),
    (category) => category.affisellCommissionRateBps,
    taxonomy
  )
}

export function buildCategorySupplierBpsPlan(
  categories: ReadonlyArray<{
    id: string
    googleId: number | null
    fullPath: string
    supplierCommissionRateBps: number | null
  }>,
  taxonomy?: TaxonomyEnRow[]
): CategoryCommissionTarget[] {
  return buildCategoryBpsPlan(
    categories,
    (category, googleIdToSlugPath) =>
      resolveGridSupplierBpsForCategory({
        googleId: category.googleId,
        fullPath: category.fullPath,
        googleIdToSlugPath,
      }),
    (category) => category.supplierCommissionRateBps,
    taxonomy
  )
}

export function summarizeCommissionPlan(plan: CategoryCommissionTarget[]): {
  total: number
  unchanged: number
  updated: number
  byTargetBps: Map<number, number>
} {
  const byTargetBps = new Map<number, number>()
  let unchanged = 0
  let updated = 0

  for (const row of plan) {
    byTargetBps.set(row.targetBps, (byTargetBps.get(row.targetBps) ?? 0) + 1)
    if (row.currentBps === row.targetBps) unchanged++
    else updated++
  }

  return { total: plan.length, unchanged, updated, byTargetBps }
}
