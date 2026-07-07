import { unstable_cache } from "next/cache"

import {
  AFFISELL_BROWSE_DEPARTMENTS,
  type BrowseDepartmentDef,
  type BrowseDepartmentTarget,
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

async function resolveTarget(
  target: BrowseDepartmentTarget
): Promise<{
  categoryId: string | null
  categorySlug: string | null
  searchQuery: string | null
  googleId: number | null
  name: string | null
}> {
  if (target.kind === "search") {
    return { categoryId: null, categorySlug: null, searchQuery: target.queryFr, googleId: null, name: null }
  }

  if (target.kind === "googleRoot") {
    const row = await withPrismaReconnect(() =>
      prisma.category.findFirst({
        where: { parentId: null, name: target.rootNameFr },
        select: { id: true, slug: true, googleId: true, name: true },
      })
    )
    return {
      categoryId: row?.id ?? null,
      categorySlug: row?.slug ?? null,
      searchQuery: null,
      googleId: row?.googleId ?? null,
      name: row?.name ?? null,
    }
  }

  const row = await withPrismaReconnect(() =>
    prisma.category.findFirst({
      where: { fullPath: target.fullPathFr },
      select: { id: true, slug: true, googleId: true, name: true },
    })
  )
  return {
    categoryId: row?.id ?? null,
    categorySlug: row?.slug ?? null,
    searchQuery: null,
    googleId: row?.googleId ?? null,
    name: row?.name ?? null,
  }
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

async function loadBrowseDepartmentsUncached(locale: AppLocale): Promise<BrowseDepartmentsPayload> {
  const departments: ResolvedBrowseDepartment[] = []

  for (const def of AFFISELL_BROWSE_DEPARTMENTS) {
    const resolved = await resolveTarget(def.target)
    departments.push({
      id: def.id,
      icon: def.icon,
      label: departmentLabel(def, locale, resolved),
      categoryId: resolved.categoryId,
      categorySlug: resolved.categorySlug,
      searchQuery: resolved.searchQuery,
      resolved: Boolean(resolved.categoryId || resolved.searchQuery),
    })
  }

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
