import type { CategoryAttribute } from "@prisma/client"

import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import { mergeCoreCategoryAttrs } from "@/lib/category-attribute-core"
import { resolveCategoryAttributesForForm } from "@/lib/category-attribute-resolution"

export type CategoryAttributeValidationRule = {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
}

export function parseValidationRule(raw: unknown): CategoryAttributeValidationRule | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const out: CategoryAttributeValidationRule = {}
  if (typeof o.min === "number" && Number.isFinite(o.min)) out.min = o.min
  if (typeof o.max === "number" && Number.isFinite(o.max)) out.max = o.max
  if (typeof o.minLength === "number" && Number.isFinite(o.minLength)) out.minLength = o.minLength
  if (typeof o.maxLength === "number" && Number.isFinite(o.maxLength)) out.maxLength = o.maxLength
  if (typeof o.pattern === "string" && o.pattern.trim()) out.pattern = o.pattern.trim()
  return Object.keys(out).length > 0 ? out : null
}

/** Whether a taxonomy field should render for the current form values. */
export function isCategoryAttributeVisible(
  attr: Pick<CategoryAttrRow, "key" | "dependsOnKey" | "dependsOnValue">,
  values: Record<string, string>
): boolean {
  const parentKey = attr.dependsOnKey?.trim()
  if (!parentKey) return true
  const expected = attr.dependsOnValue?.trim() ?? ""
  const actual = (values[parentKey] ?? "").trim()
  if (!expected) return actual.length > 0
  return actual.toLowerCase() === expected.toLowerCase()
}

export function filterVisibleCategoryAttributes(
  attrs: CategoryAttrRow[],
  values: Record<string, string>
): CategoryAttrRow[] {
  return attrs.filter((a) => isCategoryAttributeVisible(a, values))
}

/** Drop values for fields hidden by dependency rules (e.g. brand changed). */
export function pruneHiddenCategoryAttributeValues(
  attrs: CategoryAttrRow[],
  values: Record<string, string>
): Record<string, string> {
  const visibleKeys = new Set(filterVisibleCategoryAttributes(attrs, values).map((a) => a.key))
  const out: Record<string, string> = {}
  for (const key of visibleKeys) {
    if (key in values) out[key] = values[key]!
  }
  return out
}

function normAttrType(t: string | undefined): string {
  return (t ?? "TEXT").toUpperCase().replace(/\s+/g, "_")
}

export function validateCategoryAttributeValue(
  attr: CategoryAttrRow,
  rawValue: string
): string | null {
  const v = rawValue.trim()
  if (attr.required && !v) return `${attr.label} est requis`

  const tp = normAttrType(attr.type)
  const rule = attr.validationRule
  if (!rule || !v) return null

  if (tp === "MULTI_SELECT" || tp === "MULTI") {
    const parts = v.split("|").map((s) => s.trim()).filter(Boolean)
    if (attr.required && parts.length === 0) return `${attr.label} est requis`
  }

  if (tp === "NUMBER" || tp === "DECIMAL") {
    const n = Number(v.replace(",", "."))
    if (!Number.isFinite(n)) return `${attr.label} : valeur numérique invalide`
    if (rule.min != null && n < rule.min) return `${attr.label} : minimum ${rule.min}`
    if (rule.max != null && n > rule.max) return `${attr.label} : maximum ${rule.max}`
  }

  if (rule.minLength != null && v.length < rule.minLength) {
    return `${attr.label} : minimum ${rule.minLength} caractères`
  }
  if (rule.maxLength != null && v.length > rule.maxLength) {
    return `${attr.label} : maximum ${rule.maxLength} caractères`
  }
  if (rule.pattern) {
    try {
      if (!new RegExp(rule.pattern).test(v)) return `${attr.label} : format invalide`
    } catch {
      /* ignore bad patterns in DB */
    }
  }

  if (rule.min != null || rule.max != null) {
    if (tp !== "NUMBER" && tp !== "DECIMAL") {
      const n = Number(v.replace(",", "."))
      if (Number.isFinite(n)) {
        if (rule.min != null && n < rule.min) return `${attr.label} : minimum ${rule.min}`
        if (rule.max != null && n > rule.max) return `${attr.label} : maximum ${rule.max}`
      }
    }
  }

  return null
}

export function collectVisibleCategoryAttributeErrors(
  attrs: CategoryAttrRow[],
  values: Record<string, string>
): string[] {
  const errors: string[] = []
  for (const attr of filterVisibleCategoryAttributes(attrs, values)) {
    const err = validateCategoryAttributeValue(attr, values[attr.key] ?? "")
    if (err) errors.push(err)
  }
  return errors
}

/** First validation error for visible fields, or null if valid. */
export function firstVisibleCategoryAttributeError(
  attrs: CategoryAttrRow[],
  values: Record<string, string>
): string | null {
  const errors = collectVisibleCategoryAttributeErrors(attrs, values)
  return errors[0] ?? null
}

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

export type CategoryAttributeValuesInput =
  | Record<string, unknown>
  | Array<{ key?: unknown; value?: unknown; label?: unknown }>

/** Normalise API body (`productAttributes` or `attributeValues`) to a string map. */
export function normalizeCategoryAttributeValues(raw: CategoryAttributeValuesInput): Record<string, string> {
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {}
    for (const row of raw) {
      const key = String(row?.key ?? "").trim()
      if (!key) continue
      out[key] = String(row?.value ?? "").trim()
    }
    return out
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue
    out[key] = String(value).trim()
  }
  return out
}

export class CategoryAttributeValidationError extends Error {
  readonly errors: string[]

  constructor(errors: string[]) {
    super(errors.join(", "))
    this.name = "CategoryAttributeValidationError"
    this.errors = errors
  }
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

  const dbRows = await resolveCategoryAttributesForForm(cid)
  const attrs = mergeCoreCategoryAttrs(prismaCategoryAttributesToFormRows(dbRows))
  const values = normalizeCategoryAttributeValues(attributeValues)
  const errors = collectVisibleCategoryAttributeErrors(attrs, values)

  if (errors.length > 0) {
    throw new CategoryAttributeValidationError(errors)
  }
}
