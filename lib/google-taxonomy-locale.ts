import fs from "node:fs"
import path from "node:path"

import type { AppLocale } from "@/lib/i18n-locale"

let enByGoogleId: Map<number, string> | null = null

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

/** Display label for a category row stored with Google taxonomy (FR in DB). */
export function localizeCategoryName(
  row: { googleId: number | null; name: string },
  locale: AppLocale
): string {
  if (locale !== "en" || row.googleId == null) return row.name
  return loadEnByGoogleId().get(row.googleId) ?? row.name
}

export function localizeCategoryTree<
  T extends {
    name: string
    googleId?: number | null
    subcategories?: Array<{ name: string; googleId?: number | null }>
  },
>(categories: T[], locale: AppLocale): T[] {
  return categories.map((cat) => ({
    ...cat,
    name: localizeCategoryName(
      { googleId: cat.googleId ?? null, name: cat.name },
      locale
    ),
    subcategories: cat.subcategories?.map((sub) => ({
      ...sub,
      name: localizeCategoryName(
        { googleId: sub.googleId ?? null, name: sub.name },
        locale
      ),
    })),
  }))
}
