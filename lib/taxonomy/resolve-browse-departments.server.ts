import { unstable_cache } from "next/cache"

import {
  AFFISELL_BROWSE_DEPARTMENTS,
  type BrowseDepartmentDef,
  type BrowseDepartmentTarget,
  type ResolvedBrowseDepartment,
} from "@/lib/taxonomy/browse-departments-shared"
import type { AppLocale } from "@/lib/i18n-locale"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type BrowseDepartmentsPayload = {
  departments: ResolvedBrowseDepartment[]
  locale: AppLocale
}

async function resolveTarget(
  target: BrowseDepartmentTarget
): Promise<{ categoryId: string | null; searchQuery: string | null }> {
  if (target.kind === "search") {
    return { categoryId: null, searchQuery: target.queryFr }
  }

  if (target.kind === "googleRoot") {
    const row = await withPrismaReconnect(() =>
      prisma.category.findFirst({
        where: { parentId: null, name: target.rootNameFr },
        select: { id: true },
      })
    )
    return { categoryId: row?.id ?? null, searchQuery: null }
  }

  const row = await withPrismaReconnect(() =>
    prisma.category.findFirst({
      where: { fullPath: target.fullPathFr },
      select: { id: true },
    })
  )
  return { categoryId: row?.id ?? null, searchQuery: null }
}

function labelFor(def: BrowseDepartmentDef, locale: AppLocale): string {
  return locale === "en" ? def.labelEn : def.labelFr
}

async function loadBrowseDepartmentsUncached(locale: AppLocale): Promise<BrowseDepartmentsPayload> {
  const departments: ResolvedBrowseDepartment[] = []

  for (const def of AFFISELL_BROWSE_DEPARTMENTS) {
    const { categoryId, searchQuery } = await resolveTarget(def.target)
    departments.push({
      id: def.id,
      icon: def.icon,
      label: labelFor(def, locale),
      categoryId,
      searchQuery,
      resolved: Boolean(categoryId || searchQuery),
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
