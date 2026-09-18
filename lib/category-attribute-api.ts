import type { CategoryAttribute } from "@prisma/client"

import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

import type { CategoryAttributeValidationRule } from "@/lib/category-attribute-rules-shared"
import { parseValidationRule } from "@/lib/category-attribute-rules-shared"

export type CategoryAttributeOptionDto = {
  id: string
  value: string
  slug: string
  hexColor: string | null
  sortOrder: number
}

/** Client-facing row (Amazon-style dynamic form). */
export type CategoryAttributeDto = {
  id: string
  categoryId: string
  key: string
  label: string
  /** Localized label for display only; `label` stays canonical (validation, persistence). */
  displayLabel?: string
  type: string
  unit: string | null
  options: string[]
  required: boolean
  /** Mirrors DB `aiSuggest` — optional fields that boost listing quality. */
  recommended: boolean
  sortOrder: number
  order: number
  validationRule: CategoryAttributeValidationRule | null
  dependsOnKey: string | null
  dependsOnValue: string | null
  helpText: string | null
  /** Global catalog link (v2). */
  attributeId?: string | null
  attributeSlug?: string
  isVariant?: boolean
  isFilterable?: boolean
  appliesToDescendants?: boolean
  optionDetails?: CategoryAttributeOptionDto[]
}

export function categoryAttributeToDto(row: CategoryAttribute): CategoryAttributeDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    key: row.key,
    label: row.label,
    type: row.type,
    unit: row.unit,
    options: row.options ?? [],
    required: row.required,
    recommended: row.aiSuggest,
    sortOrder: row.order,
    order: row.order,
    validationRule: parseValidationRule(row.validationRule),
    dependsOnKey: row.dependsOnKey,
    dependsOnValue: row.dependsOnValue,
    helpText: row.helpText,
    attributeId: row.attributeId,
    isVariant: row.isVariant,
    isFilterable: row.isFilterable ?? row.showInFilter,
    appliesToDescendants: row.appliesToDescendants,
  }
}

/** Adds `displayLabel` from the `categoryAttributes.labels.<key>` catalog; unknown keys keep `label`. */
export function withDisplayLabels(
  attrs: CategoryAttributeDto[],
  locale: AppLocale
): CategoryAttributeDto[] {
  return attrs.map((a) => {
    const localized = tMessage(locale, `categoryAttributes.labels.${a.key}`, "")
    return localized ? { ...a, displayLabel: localized } : a
  })
}

export function categoryAttributesToDto(rows: CategoryAttribute[]): CategoryAttributeDto[] {
  return rows.map(categoryAttributeToDto)
}
