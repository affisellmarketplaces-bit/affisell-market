import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"

/** Shown for every product when taxonomy does not already define the same key. */
export const CORE_SPEC_FIELDS_PRESET: CategoryAttrRow[] = [
  {
    id: "aff-core-brand",
    key: "brand",
    label: "Marque",
    type: "TEXT",
    unit: null,
    options: [],
    required: true,
    order: -300,
  },
  {
    id: "aff-core-size",
    key: "size",
    label: "Taille",
    type: "TEXT",
    unit: null,
    options: [],
    required: false,
    order: -299,
  },
  {
    id: "aff-core-color",
    key: "color",
    label: "Couleur",
    type: "TEXT",
    unit: null,
    options: [],
    required: false,
    order: -298,
  },
]

export function mergeCoreCategoryAttrs(categoryAttrs: CategoryAttrRow[]): CategoryAttrRow[] {
  const seen = new Set(categoryAttrs.map((a) => a.key.toLowerCase()))
  const prefix: CategoryAttrRow[] = []
  for (const c of CORE_SPEC_FIELDS_PRESET) {
    if (!seen.has(c.key.toLowerCase())) prefix.push(c)
  }
  const merged = [...prefix, ...categoryAttrs]
  merged.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  return merged
}
