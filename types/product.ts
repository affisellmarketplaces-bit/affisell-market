export type CustomColumnType = "text" | "number" | "boolean" | "url" | "select"

export type CustomColumn = {
  key: string
  label: string
  type: CustomColumnType
  required: boolean
  options?: string[]
}

/** Client-only row id for React lists */
export type CustomColumnUi = CustomColumn & { id: string }

export type VariantCustomData = Record<string, string | number | boolean>
