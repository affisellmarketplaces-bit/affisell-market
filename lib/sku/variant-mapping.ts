/** Manual AE picker map: attribute name → value shown on AliExpress. */
export type VariantMappingRecord = Record<string, string>

export function isVariantMappingRecord(v: unknown): v is VariantMappingRecord {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false
  return Object.entries(v).every(
    ([k, val]) => typeof k === "string" && k.trim().length > 0 && typeof val === "string" && val.trim().length > 0
  )
}

export function parseVariantMapping(json: unknown): VariantMappingRecord | null {
  if (!isVariantMappingRecord(json)) return null
  const out: VariantMappingRecord = {}
  for (const [k, val] of Object.entries(json)) {
    out[k.trim()] = val.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Derive color/size columns from common AE attribute keys. */
export function colorSizeFromAttributes(attrs: VariantMappingRecord): {
  color: string | null
  size: string | null
} {
  let color: string | null = null
  let size: string | null = null
  for (const [key, value] of Object.entries(attrs)) {
    const k = key.toLowerCase()
    if (!color && (k.includes("color") || k.includes("couleur"))) color = value
    if (!size && (k.includes("size") || k.includes("taille"))) size = value
  }
  return { color, size }
}
