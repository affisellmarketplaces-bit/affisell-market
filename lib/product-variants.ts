/** Stable id for advanced variant rows (client + server). */
export function newVariantRowId(): string {
  const fn = globalThis.crypto?.randomUUID
  if (typeof fn === "function") return fn.call(globalThis.crypto)
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Advanced SKU rows (supplier dashboard). Stored under `variants` JSON on Product. */
export type ProductVariantLine = {
  id: string
  name: string
  sku: string
  /** Override price for this SKU (cents); falls back to product base when 0 */
  priceCents: number
  stock: number
  /** Margin commission % for this line */
  commission: number
  /** Display-only sales hint for supplier dashboard */
  sales: number
}

export type ProductVariantsJson = {
  size?: string[]
  storage?: string[]
  ram?: string[]
  material?: string[]
  model?: string
  /** Optional map color name → image URL for PDP hero swap */
  imageByColor?: Record<string, string>
  /** Advanced matrix / SKU lines */
  variantRows?: ProductVariantLine[]
}

function parseVariantLine(raw: unknown): ProductVariantLine | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const id =
    typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 80) : newVariantRowId()
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 160) : ""
  if (!name) return null
  const sku = typeof r.sku === "string" ? r.sku.trim().slice(0, 80) : ""
  const priceCents =
    typeof r.priceCents === "number" && Number.isFinite(r.priceCents)
      ? Math.max(0, Math.round(r.priceCents))
      : typeof r.priceEur === "number" && Number.isFinite(r.priceEur)
        ? Math.max(0, Math.round(r.priceEur * 100))
        : 0
  const stock =
    typeof r.stock === "number" && Number.isFinite(r.stock) ? Math.max(0, Math.round(r.stock)) : 0
  const commission =
    typeof r.commission === "number" && Number.isFinite(r.commission)
      ? Math.min(99, Math.max(0, Math.round(r.commission)))
      : 20
  const sales =
    typeof r.sales === "number" && Number.isFinite(r.sales) ? Math.max(0, Math.round(r.sales)) : 0
  return { id, name, sku, priceCents, stock, commission, sales }
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
  if (Array.isArray(o.variantRows)) {
    const parsed = o.variantRows
      .map(parseVariantLine)
      .filter((x): x is ProductVariantLine => x !== null)
      .slice(0, 500)
    if (parsed.length) out.variantRows = parsed
  }
  return Object.keys(out).length ? out : null
}

/** Shallow merge / patch helper for client editors */
export function patchProductVariants(
  prev: ProductVariantsJson | null,
  patch: Partial<ProductVariantsJson>
): ProductVariantsJson | null {
  const base: ProductVariantsJson = { ...(prev ?? {}) }
  for (const [k, val] of Object.entries(patch) as [keyof ProductVariantsJson, unknown][]) {
    if (val === undefined) {
      delete (base as Record<string, unknown>)[k as string]
      continue
    }
    ;(base as Record<string, unknown>)[k as string] = val as unknown
  }
  return Object.keys(base).length ? base : null
}

export function variantsFromDb(raw: unknown): ProductVariantsJson | null {
  return parseVariantsPayload(raw)
}
