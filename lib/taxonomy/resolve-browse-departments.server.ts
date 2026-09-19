import { unstable_cache } from "next/cache"

import {
  AFFISELL_BROWSE_DEPARTMENTS,
  type BrowseDepartmentDef,
  type ResolvedBrowseDepartment,
} from "@/lib/taxonomy/browse-departments-shared"
import { localizeCategoryName } from "@/lib/google-taxonomy-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type BrowseDepartmentsPayload = {
  departments: ResolvedBrowseDepartment[]
  locale: AppLocale
}

function marketingLabel(def: BrowseDepartmentDef, locale: AppLocale): string {
  return resolveBinaryCopyLocale(locale) === "fr" ? def.labelFr : def.labelEn
}

function departmentLabel(
  def: BrowseDepartmentDef,
  locale: AppLocale,
  resolved: { googleId: number | null; name: string | null; searchQuery: string | null }
): string {
  if (resolved.searchQuery) return marketingLabel(def, locale)
  if (resolved.googleId != null && resolved.name) {
    return localizeCategoryName({ googleId: resolved.googleId, name: resolved.name }, locale)
  }
  return marketingLabel(def, locale)
}

type ResolvedRow = { id: string; slug: string; googleId: number | null; name: string }

/** Two queries for ALL departments (was one per department — 50 sequential round-trips on a cold database). */
async function loadBrowseDepartmentsUncached(locale: AppLocale): Promise<BrowseDepartmentsPayload> {
  const rootNames = AFFISELL_BROWSE_DEPARTMENTS.flatMap((d) => (d.target.kind === "googleRoot" ? [d.target.rootNameFr] : []))
  const fullPaths = AFFISELL_BROWSE_DEPARTMENTS.flatMap((d) => (d.target.kind === "googleFullPath" ? [d.target.fullPathFr] : []))

  const [rootRows, pathRows] = await Promise.all([
    withPrismaReconnect(() =>
      prisma.category.findMany({
        where: { parentId: null, name: { in: rootNames } },
        select: { id: true, slug: true, googleId: true, name: true },
      })
    ),
    withPrismaReconnect(() =>
      prisma.category.findMany({
        where: { fullPath: { in: fullPaths } },
        select: { id: true, slug: true, googleId: true, name: true, fullPath: true },
      })
    ),
  ])
  const byRootName = new Map<string, ResolvedRow>(rootRows.map((r) => [r.name, r]))
  const byFullPath = new Map<string, ResolvedRow>(pathRows.map((r) => [r.fullPath, r]))

  const departments: ResolvedBrowseDepartment[] = AFFISELL_BROWSE_DEPARTMENTS.map((def) => {
    const t = def.target
    const row: ResolvedRow | undefined =
      t.kind === "googleRoot" ? byRootName.get(t.rootNameFr) : t.kind === "googleFullPath" ? byFullPath.get(t.fullPathFr) : undefined
    const searchQuery = t.kind === "search" ? t.queryFr : null
    const resolved = { googleId: row?.googleId ?? null, name: row?.name ?? null, searchQuery }
    return {
      id: def.id,
      icon: def.icon,
      label: departmentLabel(def, locale, resolved),
      categoryId: row?.id ?? null,
      categorySlug: row?.slug ?? null,
      searchQuery,
      resolved: Boolean(row?.id || searchQuery),
    }
  })

  const unresolved = departments.filter((d) => !d.resolved).map((d) => d.id)
  if (unresolved.length > 0) {
    console.log("[taxonomy/browse-departments]", { unresolved, locale })
  }

  return { departments, locale }
}

export async function loadBrowseDepartmentsCached(locale: AppLocale): Promise<BrowseDepartmentsPayload> {
  return unstable_cache(() => loadBrowseDepartmentsUncached(locale), ["browse-departments", locale], {
    revalidate: 300,
  })()
}
