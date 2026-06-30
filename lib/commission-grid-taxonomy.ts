import { readFileSync } from "node:fs"
import { resolve } from "node:path"

export type TaxonomyEnRow = {
  googleId: number
  pathEn: string
  slugPath: string
}

/** Google EN path → slug grille (`apparel_accessories > clothing`). */
export function slugifyTaxonomyPath(pathEn: string): string {
  return pathEn
    .split(" > ")
    .map((seg) =>
      seg
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/&/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_")
    )
    .join(" > ")
}

export function loadTaxonomyEnRows(taxonomyPath?: string): TaxonomyEnRow[] {
  const filePath = taxonomyPath ?? resolve(process.cwd(), "prisma/taxonomy-en.txt")
  const raw = readFileSync(filePath, "utf8")
  const rows: TaxonomyEnRow[] = []

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = /^(\d+)\s+-\s+(.+)$/.exec(trimmed)
    if (!match) continue
    const googleId = Number(match[1])
    const pathEn = match[2].trim()
    if (!Number.isFinite(googleId) || !pathEn) continue
    rows.push({ googleId, pathEn, slugPath: slugifyTaxonomyPath(pathEn) })
  }

  return rows
}

export function googleIdsMatchingSlugPrefix(
  taxonomy: TaxonomyEnRow[],
  googleSlug: string
): number[] {
  const normalized = googleSlug.trim().toLowerCase()
  if (!normalized) return []

  return taxonomy
    .filter(
      (row) =>
        row.slugPath === normalized || row.slugPath.startsWith(`${normalized} > `)
    )
    .map((row) => row.googleId)
}

export function googleIdsForGridSlugs(
  taxonomy: TaxonomyEnRow[],
  googleSlugs: readonly string[]
): number[] {
  const ids = new Set<number>()
  for (const slug of googleSlugs) {
    for (const id of googleIdsMatchingSlugPrefix(taxonomy, slug)) {
      ids.add(id)
    }
  }
  return [...ids]
}
