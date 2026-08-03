import { unwrapAliExpressMethodResponse } from "@/lib/aliexpress-open-api"

export type AeProductSpecRow = {
  key: string
  value: string
  label: string
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return ""
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function slugKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64)
}

function collectPropList(result: Record<string, unknown>): Record<string, unknown>[] {
  const candidates = [
    result.ae_item_properties,
    result.ae_item_property_list,
    result.item_property_list,
    result.product_property_list,
    result.properties,
    asRecord(result.ae_item_properties)?.ae_item_property,
    asRecord(result.ae_item_properties)?.ae_item_property_d_t_o,
    asRecord(result.ae_item_properties)?.ae_item_property_dto,
  ]

  for (const raw of candidates) {
    if (Array.isArray(raw)) {
      return raw.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => Boolean(x))
    }
    const one = asRecord(raw)
    if (one && (one.attr_name || one.attribute_name || one.name || one.property_name)) {
      return [one]
    }
  }
  return []
}

/**
 * Parse product-level specs / characteristics from `aliexpress.ds.product.get`.
 */
export function parseAeProductSpecsFromPayload(payload: unknown): AeProductSpecRow[] {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? asRecord(payload) ?? {}
  const props = collectPropList(result)
  const out: AeProductSpecRow[] = []
  const seen = new Set<string>()

  for (const prop of props) {
    const label =
      pickString(prop, [
        "attr_name",
        "attribute_name",
        "property_name",
        "name",
        "attr_name_id",
      ]) || "Spec"
    const value = pickString(prop, [
      "attr_value",
      "attribute_value",
      "property_value",
      "value",
      "attr_value_id",
    ])
    if (!value) continue
    const key = slugKey(label) || `spec_${out.length + 1}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      label: label.slice(0, 80),
      value: value.slice(0, 500),
    })
    if (out.length >= 40) break
  }

  return out
}

export function specsToDescriptionBullets(specs: AeProductSpecRow[], max = 12): string[] {
  return specs.slice(0, max).map((s) => `${s.label}: ${s.value}`)
}
