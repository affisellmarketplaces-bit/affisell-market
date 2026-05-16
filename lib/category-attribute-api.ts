import type { CategoryAttribute } from "@prisma/client"

/** Client-facing row (Amazon-style dynamic form). */
export type CategoryAttributeDto = {
  id: string
  categoryId: string
  key: string
  label: string
  type: string
  unit: string | null
  options: string[]
  required: boolean
  /** Mirrors DB `aiSuggest` — optional fields that boost listing quality. */
  recommended: boolean
  sortOrder: number
  order: number
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
  }
}

export function categoryAttributesToDto(rows: CategoryAttribute[]): CategoryAttributeDto[] {
  return rows.map(categoryAttributeToDto)
}
