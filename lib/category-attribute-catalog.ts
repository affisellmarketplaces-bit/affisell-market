import type { Attribute, AttributeOption, CategoryAttribute } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { CategoryAttributeDto } from "@/lib/category-attribute-api"
import { categoryAttributeToDto } from "@/lib/category-attribute-api"
import { parseValidationRule } from "@/lib/category-attribute-rules"
import { mergeMarketplaceStyleSupplements } from "@/lib/marketplace-style-spec-supplements"

import {
  categoryAncestorChainIds,
  genericFallbackRows,
} from "@/lib/category-attribute-resolution"

export type CategoryAttributeWithCatalog = CategoryAttribute & {
  attribute: (Attribute & { options: AttributeOption[] }) | null
}

function slugifyAttributeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function mapLegacyTypeToEnum(type: string, unit: string | null): string {
  const t = type.trim().toUpperCase().replace(/\s+/g, "_")
  if (unit?.trim()) return "UNIT_VALUE"
  if (t === "SELECT" || t === "SELECT_SINGLE") return "SELECT_SINGLE"
  if (t === "MULTI_SELECT" || t === "MULTI") return "SELECT_MULTI"
  if (t === "NUMBER" || t === "DECIMAL") return "NUMBER"
  if (t === "BOOLEAN") return "BOOLEAN"
  if (t === "TEXTAREA") return "TEXTAREA"
  return "TEXT"
}

function resolvedOptions(row: CategoryAttributeWithCatalog): string[] {
  const catalog = row.attribute?.options ?? []
  if (catalog.length > 0) {
    return catalog.sort((a, b) => a.sortOrder - b.sortOrder).map((o) => o.value)
  }
  return row.options ?? []
}

function resolvedType(row: CategoryAttributeWithCatalog): string {
  if (row.attribute?.type) return row.attribute.type
  return mapLegacyTypeToEnum(row.type, row.unit)
}

function resolvedUnit(row: CategoryAttributeWithCatalog): string | null {
  return row.attribute?.unit ?? row.unit
}

function resolvedValidation(row: CategoryAttributeWithCatalog) {
  const fromCatalog = row.attribute?.validationJson
  if (fromCatalog) return parseValidationRule(fromCatalog)
  return parseValidationRule(row.validationRule)
}

/** Enriched DTO for supplier form + variant dimension hints. */
export function categoryAttributeWithCatalogToDto(
  row: CategoryAttributeWithCatalog
): CategoryAttributeDto {
  const base = categoryAttributeToDto(row)
  return {
    ...base,
    attributeId: row.attributeId,
    attributeSlug: row.attribute?.slug ?? slugifyAttributeKey(row.key),
    type: resolvedType(row),
    unit: resolvedUnit(row),
    options: resolvedOptions(row),
    validationRule: resolvedValidation(row),
    isVariant: row.isVariant,
    isFilterable: row.isFilterable ?? row.showInFilter,
    appliesToDescendants: row.appliesToDescendants,
    optionDetails: (row.attribute?.options ?? []).map((o) => ({
      id: o.id,
      value: o.value,
      slug: o.slug,
      hexColor: o.hexColor,
      sortOrder: o.sortOrder,
    })),
  }
}

function mergeAttributeRows(
  primary: CategoryAttributeWithCatalog[],
  inherited: CategoryAttributeWithCatalog[]
): CategoryAttributeWithCatalog[] {
  const byKey = new Map<string, CategoryAttributeWithCatalog>()
  for (const row of inherited) {
    if (row.appliesToDescendants) byKey.set(row.key, row)
  }
  for (const row of primary) {
    byKey.set(row.key, row)
  }
  return [...byKey.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
}

const categoryAttributeInclude = {
  attribute: {
    include: {
      options: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} as const

/**
 * Resolve category specs using global `Attribute` catalog when linked,
 * with descendant inheritance via `appliesToDescendants`.
 */
export async function resolveCategoryAttributesForFormV2(
  categoryId: string
): Promise<CategoryAttributeDto[]> {
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
    const fallback = genericFallbackRows(categoryId).map((r) => ({
      ...r,
      attributeId: null,
      isVariant: r.key === "color",
      isFilterable: r.showInFilter,
      appliesToDescendants: false,
      attribute: null,
    }))
    return mergeMarketplaceStyleSupplements(categoryId, [], fallback).map(
      categoryAttributeWithCatalogToDto
    )
  }

  const all = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: chain } },
    include: categoryAttributeInclude,
    orderBy: [{ order: "asc" }, { label: "asc" }],
  })

  let primary: CategoryAttributeWithCatalog[] = []
  for (const cid of chain) {
    const rows = all.filter((a) => a.categoryId === cid)
    if (rows.length > 0) {
      primary = rows
      break
    }
  }

  const inherited = all.filter((a) => a.appliesToDescendants)
  let merged =
    primary.length > 0
      ? mergeAttributeRows(primary, inherited)
      : genericFallbackRows(categoryId).map((r) => ({
          ...r,
          attributeId: null,
          isVariant: r.key === "color",
          isFilterable: r.showInFilter,
          appliesToDescendants: false,
          attribute: null,
        }))

  merged = mergeMarketplaceStyleSupplements(
    categoryId,
    chainSlugs,
    merged as CategoryAttribute[]
  ) as CategoryAttributeWithCatalog[]

  return merged.map(categoryAttributeWithCatalogToDto)
}

export { slugifyAttributeKey, mapLegacyTypeToEnum }
