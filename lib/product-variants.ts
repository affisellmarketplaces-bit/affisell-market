export type ProductVariantsJson = {
  size?: string[]
  storage?: string[]
  ram?: string[]
  material?: string[]
  model?: string
  /** Optional map color name → image URL for PDP hero swap */
  imageByColor?: Record<string, string>
}

export function parseVariantsPayload(raw: unknown): ProductVariantsJson | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const out: ProductVariantsJson = {}
  const arrayKeys = ["size", "storage", "ram", "material"] as const
  for (const k of arrayKeys) {
    if (Array.isArray(o[k])) {
      const arr = (o[k] as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
      if (arr.length) out[k] = arr.slice(0, 40)
    }
  }
  if (typeof o.model === "string" && o.model.trim()) {
    out.model = o.model.trim().slice(0, 240)
  }
  const ibc = o.imageByColor
  if (ibc && typeof ibc === "object" && !Array.isArray(ibc)) {
    const rec: Record<string, string> = {}
    for (const [key, val] of Object.entries(ibc)) {
      if (typeof val === "string" && val.trim()) rec[key.trim()] = val.trim()
    }
    if (Object.keys(rec).length) out.imageByColor = rec
  }
  return Object.keys(out).length ? out : null
}

export function variantsFromDb(raw: unknown): ProductVariantsJson | null {
  return parseVariantsPayload(raw)
}
