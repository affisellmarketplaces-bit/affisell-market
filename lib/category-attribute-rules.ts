import "server-only"

import type { CategoryAttribute } from "@prisma/client"

import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import { mergeCoreCategoryAttrs } from "@/lib/category-attribute-core"

export * from "@/lib/category-attribute-rules-shared"

import {
  CategoryAttributeValidationError,
  collectVisibleCategoryAttributeErrors,
  normalizeCategoryAttributeValues,
  parseValidationRule,
  type CategoryAttributeValuesInput,
} from "@/lib/category-attribute-rules-shared"

export function prismaCategoryAttributesToFormRows(rows: CategoryAttribute[]): CategoryAttrRow[] {
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    unit: row.unit,
    options: row.options ?? [],
    required: row.required,
    order: row.order,
    recommended: row.aiSuggest,
    validationRule: parseValidationRule(row.validationRule),
    dependsOnKey: row.dependsOnKey,
    dependsOnValue: row.dependsOnValue,
    helpText: row.helpText,
  }))
}

/**
 * Server-side Amazon-level validation: resolves taxonomy fields (with ancestors),
 * applies dependsOn + validationRule, throws on failure.
 */
export async function validateVisibleCategoryAttributes(
  categoryId: string,
  attributeValues: CategoryAttributeValuesInput
): Promise<void> {
  const cid = categoryId.trim()
  if (!cid) return

  const { resolveCategoryAttributesForForm } = await import("@/lib/category-attribute-resolution")
  const dbRows = await resolveCategoryAttributesForForm(cid)
  const attrs = mergeCoreCategoryAttrs(prismaCategoryAttributesToFormRows(dbRows))
  const values = normalizeCategoryAttributeValues(attributeValues)
  const errors = collectVisibleCategoryAttributeErrors(attrs, values)

  if (errors.length > 0) {
    throw new CategoryAttributeValidationError(errors)
  }
}
