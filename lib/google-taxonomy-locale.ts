import fs from "node:fs"
import path from "node:path"

import type { AppLocale } from "@/lib/i18n-locale"

let enByGoogleId: Map<number, string> | null = null
let enFullPathByGoogleId: Map<number, string> | null = null

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

function loadEnByGoogleId(): Map<number, string> {
  if (!enByGoogleId) {
    try {
      enByGoogleId = parseTaxonomyFile("taxonomy-en.txt")
    } catch {
      enByGoogleId = new Map()
    }
  }
  return enByGoogleId
}

function loadEnFullPathByGoogleId(): Map<number, string> {
  if (!enFullPathByGoogleId) {
    try {
      enFullPathByGoogleId = parseTaxonomyFullPaths("taxonomy-en.txt")
    } catch {
      enFullPathByGoogleId = new Map()
    }
  }
  return enFullPathByGoogleId
}

/** Display label for a category row stored with Google taxonomy (FR in DB). */
export function localizeCategoryName(
  row: { googleId: number | null; name: string },
  locale: AppLocale
): string {
  if (locale !== "en" || row.googleId == null) return row.name
  return loadEnByGoogleId().get(row.googleId) ?? row.name
}

/** Full genealogical path (Google taxonomy) localized for marketplace browse. */
export function localizeCategoryFullPath(
  row: { googleId: number | null; fullPath: string },
  locale: AppLocale
): string {
  if (locale !== "en" || row.googleId == null) return row.fullPath
  return loadEnFullPathByGoogleId().get(row.googleId) ?? row.fullPath
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
