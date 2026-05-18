import { z } from "zod"

import type { CustomColumn, CustomColumnType, VariantCustomData } from "@/types/product"

export const CUSTOM_COLUMN_FILTER_PREFIX = "cc_"

export const customColumnSchema = z
  .object({
    key: z.string().regex(/^[a-z_]+$/, "snake_case only"),
    label: z.string().min(1).max(32),
    type: z.enum(["text", "number", "boolean", "url", "select"]),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1).max(64)).optional(),
  })
  .superRefine((col, ctx) => {
    if (col.type === "select") {
      if (!col.options?.length) {
        ctx.addIssue({
          code: "custom",
          message: "Options requises pour une colonne select",
          path: ["options"],
        })
      }
    } else if (col.options?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Options autorisées uniquement pour select",
        path: ["options"],
      })
    }
  })

export const customColumnsBodySchema = z.array(customColumnSchema).max(10).optional()

export function labelToCustomColumnKey(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "field"
  )
}

export function parseCustomColumnsFromDb(json: unknown): CustomColumn[] {
  if (!Array.isArray(json)) return []
  const out: CustomColumn[] = []
  const seen = new Set<string>()
  for (const raw of json) {
    const parsed = customColumnSchema.safeParse(raw)
    if (!parsed.success) continue
    if (seen.has(parsed.data.key)) continue
    seen.add(parsed.data.key)
    out.push(parsed.data)
    if (out.length >= 10) break
  }
  return out
}

export function parseCustomColumnsFromBody(body: Record<string, unknown>): CustomColumn[] | { error: string } {
  if (!("customColumns" in body)) return []
  const raw = body.customColumns
  if (raw == null) return []
  const parsed = customColumnsBodySchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Colonnes personnalisées invalides"
    return { error: msg }
  }
  return parsed.data ?? []
}

/** Legacy listingVariants.skuCustomColumns → typed text columns */
export function legacySkuCustomColumnsToDefinitions(
  legacy: Array<{ key?: string; label?: string }> | undefined
): CustomColumn[] {
  if (!legacy?.length) return []
  const out: CustomColumn[] = []
  for (const c of legacy) {
    const key = typeof c.key === "string" ? c.key.trim() : ""
    const label = typeof c.label === "string" ? c.label.trim() : key
    if (!key || !/^[a-z_]+$/.test(key)) continue
    out.push({
      key,
      label: label.slice(0, 32) || key,
      type: "text",
      required: false,
    })
    if (out.length >= 10) break
  }
  return out
}

export function mergeCustomColumnDefinitions(
  primary: CustomColumn[],
  legacy: CustomColumn[]
): CustomColumn[] {
  if (primary.length > 0) return primary
  return legacy
}

export function isCustomValueEmpty(type: CustomColumnType, value: unknown): boolean {
  if (value == null) return true
  if (type === "boolean") return false
  if (type === "number") {
    if (typeof value === "number") return !Number.isFinite(value)
    if (typeof value === "string") return value.trim() === ""
    return true
  }
  if (typeof value === "string") return value.trim() === ""
  return false
}

export function coerceCustomDataValue(
  type: CustomColumnType,
  raw: unknown
): string | number | boolean | undefined {
  if (raw == null || raw === "") return undefined
  switch (type) {
    case "boolean":
      if (typeof raw === "boolean") return raw
      if (raw === "true" || raw === "1" || raw === "on") return true
      if (raw === "false" || raw === "0" || raw === "off") return false
      return undefined
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."))
      return Number.isFinite(n) ? n : undefined
    }
    case "url": {
      const s = String(raw).trim()
      if (!s) return undefined
      try {
        const u = new URL(s.startsWith("http") ? s : `https://${s}`)
        return u.href.slice(0, 2000)
      } catch {
        return undefined
      }
    }
    case "select": {
      const s = String(raw).trim()
      return s || undefined
    }
    default:
      return String(raw).trim().slice(0, 500) || undefined
  }
}

export function normalizeVariantCustomData(
  columns: CustomColumn[],
  raw: unknown
): VariantCustomData {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: VariantCustomData = {}
  for (const col of columns) {
    const coerced = coerceCustomDataValue(col.type, record[col.key])
    if (coerced !== undefined) out[col.key] = coerced
  }
  return out
}

export function validateVariantsCustomData(
  columns: CustomColumn[],
  rawVariants: unknown[]
): string | null {
  const required = columns.filter((c) => c.required)
  if (required.length === 0) return null

  for (let i = 0; i < rawVariants.length; i++) {
    const raw = rawVariants[i]
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const r = raw as Record<string, unknown>
    const color = typeof r.color === "string" ? r.color.trim() : ""
    if (!color && r.stock == null && r.supplierPrice == null) continue

    const data = normalizeVariantCustomData(columns, r.customData ?? r.customFields)
    for (const col of required) {
      if (isCustomValueEmpty(col.type, data[col.key])) {
        return `Ligne ${i + 1}: champ ${col.label} requis`
      }
    }
  }
  return null
}

export function parseProductCustomColumnFilters(
  searchParams: URLSearchParams
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of searchParams.entries()) {
    if (!key.startsWith(CUSTOM_COLUMN_FILTER_PREFIX)) continue
    const colKey = key.slice(CUSTOM_COLUMN_FILTER_PREFIX.length)
    if (!/^[a-z_]+$/.test(colKey)) continue
    const value = raw.trim()
    if (value) out[colKey] = value
  }
  return out
}

export function customColumnFilterParamKey(columnKey: string): string {
  return `${CUSTOM_COLUMN_FILTER_PREFIX}${columnKey}`
}

export function buildCustomColumnProductSpecs(
  columns: CustomColumn[],
  variants: Array<{ customData?: unknown }>
): Array<{ label: string; value: string }> {
  const specs: Array<{ label: string; value: string }> = []
  for (const col of columns) {
    const values = new Set<string>()
    for (const v of variants) {
      const data = normalizeVariantCustomData(columns, v.customData)
      const raw = data[col.key]
      if (isCustomValueEmpty(col.type, raw)) continue
      values.add(formatCustomColumnSpecValue(col.type, raw as string | number | boolean))
    }
    if (values.size > 0) {
      specs.push({ label: col.label, value: [...values].join(", ") })
    }
  }
  return specs
}

export function formatCustomColumnSpecValue(
  type: CustomColumnType,
  value: string | number | boolean
): string {
  if (type === "boolean") return value ? "Oui" : "Non"
  if (type === "url" && typeof value === "string") return value
  return String(value)
}
