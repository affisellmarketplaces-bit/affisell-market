import type { ProductVariantLine } from "@/lib/product-variants"

export type SimpleColorSource = { name: string; image: string }

export function parseVariantCsvOptions(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 40)
}

export function extractOrderedColorNames(rows: SimpleColorSource[]): string[] {
  const out: string[] = []
  for (const row of rows) {
    const n = row.name.trim()
    if (!n) continue
    if (!out.some((c) => c.toLowerCase() === n.toLowerCase())) out.push(n)
  }
  return out.slice(0, 40)
}

export function buildVariantLabelsFromColorsAndSizes(colors: string[], sizes: string[]): string[] {
  if (colors.length === 0) return []
  if (sizes.length === 0) return [...colors]
  const labels: string[] = []
  for (const color of colors) {
    for (const size of sizes) {
      labels.push(`${color} / ${size}`)
    }
  }
  return labels.slice(0, 500)
}

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase()
}

/** Row name is this color alone or « color / size ». */
export function rowNameBelongsToColor(rowName: string, color: string): boolean {
  const n = normalizeLabel(rowName)
  const c = normalizeLabel(color)
  if (!c) return false
  if (n === c) return true
  if (n.startsWith(`${c} /`)) return true
  if (n.startsWith(`${c}/`)) return true
  return false
}

function findRowForExpectedLabel(
  label: string,
  color: string,
  existing: ProductVariantLine[],
  usedIds: Set<string>
): ProductVariantLine | undefined {
  const exact = existing.find((r) => !usedIds.has(r.id) && normalizeLabel(r.name) === normalizeLabel(label))
  if (exact) return exact

  const colorOnly = existing.find(
    (r) => !usedIds.has(r.id) && normalizeLabel(r.name) === normalizeLabel(color)
  )
  if (colorOnly) return colorOnly

  return existing.find(
    (r) => !usedIds.has(r.id) && rowNameBelongsToColor(r.name, color) && normalizeLabel(r.name) === normalizeLabel(label)
  )
}

function variantRowsShallowEqual(a: ProductVariantLine[], b: ProductVariantLine[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.sku !== y.sku ||
      x.priceCents !== y.priceCents ||
      x.stock !== y.stock ||
      x.commission !== y.commission ||
      (x.image ?? "") !== (y.image ?? "")
    ) {
      return false
    }
  }
  return true
}

/**
 * Build / refresh SKU table rows from « Couleurs & tailles » inputs.
 * Preserves SKU, stock, prix and commission on matched rows; keeps manual extra rows at the end.
 */
export function syncVariantRowsFromSimpleColors(params: {
  simpleColorRows: SimpleColorSource[]
  sizesText: string
  existingRows: ProductVariantLine[]
  defaultRow: () => ProductVariantLine
}): { rows: ProductVariantLine[]; colorLabels: string[] } {
  const colors = extractOrderedColorNames(params.simpleColorRows)
  if (colors.length === 0) {
    return { rows: params.existingRows, colorLabels: [] }
  }

  const sizes = parseVariantCsvOptions(params.sizesText)
  const labels = buildVariantLabelsFromColorsAndSizes(colors, sizes)
  const imageByColor = new Map<string, string>()
  for (const row of params.simpleColorRows) {
    const n = row.name.trim()
    if (!n) continue
    const img = row.image.trim()
    if (img && !imageByColor.has(n)) imageByColor.set(n, img)
  }

  const usedIds = new Set<string>()
  const result: ProductVariantLine[] = []

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!
    const color = sizes.length > 0 ? colors[Math.floor(i / sizes.length)]! : colors[i]!
    const img = imageByColor.get(color)

    const matched = findRowForExpectedLabel(label, color, params.existingRows, usedIds)
    if (matched) {
      usedIds.add(matched.id)
      const next: ProductVariantLine = { ...matched }
      if (normalizeLabel(matched.name) !== normalizeLabel(label)) {
        next.name = label
      }
      if (img && !next.image?.trim()) next.image = img
      result.push(next)
    } else {
      const fresh = params.defaultRow()
      fresh.name = label
      if (img) fresh.image = img
      result.push(fresh)
    }
  }

  for (const row of params.existingRows) {
    if (usedIds.has(row.id)) continue
    if (colors.some((c) => rowNameBelongsToColor(row.name, c))) continue
    result.push(row)
  }

  return { rows: result.slice(0, 500), colorLabels: colors }
}

export function applySimpleColorsToVariantRowsIfChanged(
  prev: ProductVariantLine[],
  params: Omit<Parameters<typeof syncVariantRowsFromSimpleColors>[0], "existingRows">
): ProductVariantLine[] {
  const { rows } = syncVariantRowsFromSimpleColors({ ...params, existingRows: prev })
  return variantRowsShallowEqual(prev, rows) ? prev : rows
}
