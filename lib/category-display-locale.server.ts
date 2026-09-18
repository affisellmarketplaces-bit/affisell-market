import "server-only"

import type { PrismaClient } from "@prisma/client"

import type { CategoryPathSegment } from "@/lib/category-browse-shared"
import type { AppLocale } from "@/lib/i18n-locale"
import { localizeCategoryName } from "@/lib/google-taxonomy-locale"

const TTL_MS = 10 * 60_000

type Meta = { googleId: number | null; name: string }

let cache: { at: number; byId: Map<string, Meta> } | null = null

async function loadMeta(prisma: PrismaClient): Promise<Map<string, Meta>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.byId
  const rows = await prisma.category.findMany({ select: { id: true, googleId: true, name: true } })
  const byId = new Map(rows.map((r) => [r.id, { googleId: r.googleId, name: r.name }] as const))
  cache = { at: Date.now(), byId }
  return byId
}

export type CategoryDisplayLocalizer = {
  name: (id: string, fallback: string) => string
  segments: (path: CategoryPathSegment[]) => CategoryPathSegment[]
  breadcrumb: (path: CategoryPathSegment[]) => string
}

/**
 * DB category names are French (Google taxonomy fr-FR). This maps them to the UI locale
 * by googleId. Ids and matching logic stay on the DB names; only display changes.
 * French is an identity fast path so existing behaviour is untouched.
 */
export async function getCategoryDisplayLocalizer(
  prisma: PrismaClient,
  locale: AppLocale
): Promise<CategoryDisplayLocalizer> {
  const name =
    locale === "fr"
      ? (_id: string, fallback: string) => fallback
      : await (async () => {
          const meta = await loadMeta(prisma)
          return (id: string, fallback: string) => {
            const m = meta.get(id)
            return m ? localizeCategoryName({ googleId: m.googleId, name: m.name }, locale) : fallback
          }
        })()

  const segments = (path: CategoryPathSegment[]) =>
    path.map((s) => ({ id: s.id, name: name(s.id, s.name) }))
  return {
    name,
    segments,
    breadcrumb: (path) => segments(path).map((s) => s.name).join(" > "),
  }
}
