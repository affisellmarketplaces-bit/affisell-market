import type { CategoryAttribute } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { mergeMarketplaceStyleSupplements } from "@/lib/marketplace-style-spec-supplements"

/** Walk leaf → parents until we find a node with `CategoryAttribute` rows. */
export async function categoryAncestorChainIds(leafCategoryId: string): Promise<string[]> {
  const chain: string[] = []
  const guard = new Set<string>()
  let current: string | null = leafCategoryId
  let depth = 0
  const maxDepth = 24
  while (current && !guard.has(current) && depth < maxDepth) {
    guard.add(current)
    chain.push(current)
    const row: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: current },
      select: { parentId: true },
    })
    current = row?.parentId ?? null
    depth += 1
  }
  return chain
}

/** Same shape as DB rows, for when no taxonomy-specific attributes exist. */
export function genericFallbackRows(forCategoryId: string): CategoryAttribute[] {
  const stamp = forCategoryId.slice(0, 12)
  const v2 = (key: string) => ({
    attributeId: null,
    isVariant: key === "color",
    isFilterable: null as boolean | null,
    appliesToDescendants: false,
  })

  const rows = [
    ["brand", "Brand name", "TEXT", true, 1, true],
    ["product_type", "Product type", "TEXT", false, 2, true],
    ["material", "Material / composition", "TEXT", false, 3, true],
    ["dimensions", "Dimensions or size", "TEXT", false, 4, true],
    ["color", "Colour", "TEXT", false, 5, true],
    ["highlights", "Key features", "TEXTAREA", false, 6, false],
    ["whats_in_box", "What's in the box", "TEXTAREA", false, 7, false],
    ["manufacturer", "Manufacturer / supplier of record", "TEXT", false, 8, true],
  ] as const

  return rows.map(([key, label, type, required, order, showInFilter]) => ({
    id: `aff-fallback-${key}-${stamp}`,
    categoryId: forCategoryId,
    key,
    label,
    type,
    unit: null,
    options: [],
    required,
    order,
    aiSuggest: true,
    showInFilter,
    validationRule: null,
    dependsOnKey: null,
    dependsOnValue: null,
    helpText: null,
    ...v2(key),
  }))
}

/**
 * Resolve specs for a picked category (usually a leaf):
 * use this node’s attributes, else the first ancestor that has any, else a sensible default set
 * so the supplier form is never empty.
 */
export async function resolveCategoryAttributesForForm(
  categoryId: string
): Promise<CategoryAttribute[]> {
  const chain = await categoryAncestorChainIds(categoryId)
  const slugRows =
    chain.length > 0
      ? await prisma.category.findMany({
          where: { id: { in: chain } },
          select: { id: true, slug: true },
        })
      : []
  const slugById = new Map(slugRows.map((r) => [r.id, r.slug]))
  const chainSlugs = chain.map((id) => slugById.get(id) ?? "")

  if (chain.length === 0) {
    return mergeMarketplaceStyleSupplements(categoryId, [], genericFallbackRows(categoryId))
  }

  const all = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: chain } },
    orderBy: [{ order: "asc" }, { label: "asc" }],
  })
  let base: CategoryAttribute[] = []
  for (const cid of chain) {
    const rows = all.filter((a) => a.categoryId === cid)
    if (rows.length > 0) {
      base = rows
      break
    }
  }
  if (base.length === 0) {
    base = genericFallbackRows(categoryId)
  }
  return mergeMarketplaceStyleSupplements(categoryId, chainSlugs, base)
}
