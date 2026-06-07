import fs from "node:fs"
import path from "node:path"

import type { AppLocale } from "@/lib/i18n-locale"

const TAXONOMY_FILE_BY_LOCALE: Record<AppLocale, string> = {
  en: "taxonomy-en.txt",
  fr: "taxonomy-fr.txt",
  de: "taxonomy-de.txt",
  es: "taxonomy-es.txt",
  it: "taxonomy-it.txt",
  nl: "taxonomy-nl.txt",
  pl: "taxonomy-pl.txt",
  zh: "taxonomy-zh.txt",
}

const nameByLocale = new Map<AppLocale, Map<number, string>>()
const fullPathByLocale = new Map<AppLocale, Map<number, string>>()

function parseTaxonomyFile(fileName: string): Map<number, string> {
  const filePath = path.join(process.cwd(), "prisma", fileName)
  const file = fs.readFileSync(filePath, "utf8")
  const map = new Map<number, string>()

  for (const line of file.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue
    const [idStr, fullPath] = line.split(" - ")
    if (!idStr || !fullPath) continue
    const googleId = Number.parseInt(idStr.trim(), 10)
    const fp = fullPath.trim()
    if (!Number.isFinite(googleId) || !fp) continue
    const parts = fp.split(" > ").map((p) => p.trim())
    const name = parts[parts.length - 1]
    if (name) map.set(googleId, name)
  }

  return map
}

function parseTaxonomyFullPaths(fileName: string): Map<number, string> {
  const filePath = path.join(process.cwd(), "prisma", fileName)
  const file = fs.readFileSync(filePath, "utf8")
  const map = new Map<number, string>()

  for (const line of file.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue
    const [idStr, fullPath] = line.split(" - ")
    if (!idStr || !fullPath) continue
    const googleId = Number.parseInt(idStr.trim(), 10)
    const fp = fullPath.trim()
    if (!Number.isFinite(googleId) || !fp) continue
    map.set(googleId, fp)
  }

  return map
}

function loadNameMap(locale: AppLocale): Map<number, string> {
  const cached = nameByLocale.get(locale)
  if (cached) return cached

  const fileName = TAXONOMY_FILE_BY_LOCALE[locale]
  try {
    const map = parseTaxonomyFile(fileName)
    nameByLocale.set(locale, map)
    return map
  } catch (error) {
    console.error("[google-taxonomy-locale] load failed", { locale, fileName, error })
    const fallback = locale === "en" ? new Map<number, string>() : loadNameMap("en")
    nameByLocale.set(locale, fallback)
    return fallback
  }
}

function loadFullPathMap(locale: AppLocale): Map<number, string> {
  const cached = fullPathByLocale.get(locale)
  if (cached) return cached

  const fileName = TAXONOMY_FILE_BY_LOCALE[locale]
  try {
    const map = parseTaxonomyFullPaths(fileName)
    fullPathByLocale.set(locale, map)
    return map
  } catch (error) {
    console.error("[google-taxonomy-locale] load fullPath failed", { locale, fileName, error })
    const fallback = locale === "en" ? new Map<number, string>() : loadFullPathMap("en")
    fullPathByLocale.set(locale, fallback)
    return fallback
  }
}

/** Display label for a category row stored with Google taxonomy (FR names in DB). */
export function localizeCategoryName(
  row: { googleId: number | null; name: string },
  locale: AppLocale
): string {
  if (row.googleId == null) return row.name
  const localized = loadNameMap(locale).get(row.googleId)
  if (localized) return localized
  return loadNameMap("en").get(row.googleId) ?? row.name
}

/** Full genealogical path (Google taxonomy) localized for marketplace browse. */
export function localizeCategoryFullPath(
  row: { googleId: number | null; fullPath: string },
  locale: AppLocale
): string {
  if (row.googleId == null) return row.fullPath
  const localized = loadFullPathMap(locale).get(row.googleId)
  if (localized) return localized
  return loadFullPathMap("en").get(row.googleId) ?? row.fullPath
}

export function localizeCategoryTree<
  T extends {
    name: string
    googleId?: number | null
    fullPath?: string
    subcategories?: Array<{
      name: string
      googleId?: number | null
      fullPath?: string
    }>
  },
>(categories: T[], locale: AppLocale): T[] {
  return categories.map((cat) => ({
    ...cat,
    name: localizeCategoryName(
      { googleId: cat.googleId ?? null, name: cat.name },
      locale
    ),
    fullPath: cat.fullPath
      ? localizeCategoryFullPath(
          { googleId: cat.googleId ?? null, fullPath: cat.fullPath },
          locale
        )
      : cat.fullPath,
    subcategories: cat.subcategories?.map((sub) => ({
      ...sub,
      name: localizeCategoryName(
        { googleId: sub.googleId ?? null, name: sub.name },
        locale
      ),
      fullPath: sub.fullPath
        ? localizeCategoryFullPath(
            { googleId: sub.googleId ?? null, fullPath: sub.fullPath },
            locale
          )
        : sub.fullPath,
    })),
  }))
}
