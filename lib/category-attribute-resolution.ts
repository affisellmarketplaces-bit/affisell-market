import type { CategoryAttribute } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { mergeMarketplaceStyleSupplements } from "@/lib/marketplace-style-spec-supplements"

/** Walk leaf → parents until we find a node with `CategoryAttribute` rows. */
async function categoryAncestorChainIds(leafCategoryId: string): Promise<string[]> {
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
  return [
    {
      id: `aff-fallback-brand-${stamp}`,
      categoryId: forCategoryId,
      key: "brand",
      label: "Brand name",
      type: "TEXT",
      unit: null,
      options: [],
      required: true,
      order: 1,
      aiSuggest: true,
      showInFilter: true,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
    {
      id: `aff-fallback-product_type-${stamp}`,
      categoryId: forCategoryId,
      key: "product_type",
      label: "Product type",
      type: "TEXT",
      unit: null,
      options: [],
      required: false,
      order: 2,
      aiSuggest: true,
      showInFilter: true,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
    {
      id: `aff-fallback-material-${stamp}`,
      categoryId: forCategoryId,
      key: "material",
      label: "Material / composition",
      type: "TEXT",
      unit: null,
      options: [],
      required: false,
      order: 3,
      aiSuggest: true,
      showInFilter: true,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
    {
      id: `aff-fallback_dimensions-${stamp}`,
      categoryId: forCategoryId,
      key: "dimensions",
      label: "Dimensions or size",
      type: "TEXT",
      unit: null,
      options: [],
      required: false,
      order: 4,
      aiSuggest: true,
      showInFilter: true,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
    {
      id: `aff-fallback_color-${stamp}`,
      categoryId: forCategoryId,
      key: "color",
      label: "Colour",
      type: "TEXT",
      unit: null,
      options: [],
      required: false,
      order: 5,
      aiSuggest: true,
      showInFilter: true,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
    {
      id: `aff-fallback_highlights-${stamp}`,
      categoryId: forCategoryId,
      key: "highlights",
      label: "Key features",
      type: "TEXTAREA",
      unit: null,
      options: [],
      required: false,
      order: 6,
      aiSuggest: true,
      showInFilter: false,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
    {
      id: `aff-fallback_whats_in_box-${stamp}`,
      categoryId: forCategoryId,
      key: "whats_in_box",
      label: "What's in the box",
      type: "TEXTAREA",
      unit: null,
      options: [],
      required: false,
      order: 7,
      aiSuggest: true,
      showInFilter: false,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
    {
      id: `aff-fallback_manufacturer-${stamp}`,
      categoryId: forCategoryId,
      key: "manufacturer",
      label: "Manufacturer / supplier of record",
      type: "TEXT",
      unit: null,
      options: [],
      required: false,
      order: 8,
      aiSuggest: true,
      showInFilter: true,
      validationRule: null,
      dependsOnKey: null,
      dependsOnValue: null,
      helpText: null,
    },
  ]
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
