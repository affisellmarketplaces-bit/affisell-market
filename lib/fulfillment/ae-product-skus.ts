import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { unwrapAliExpressMethodResponse } from "@/lib/aliexpress-open-api"
import { canonicalVariantColorKey } from "@/lib/fulfillment/variant-color-match"

export type AeProductSkuRow = {
  aeSkuId: string
  aeLabel: string
  matchColor: string | null
  matchSize: string | null
  aePriceCents: number
  stock: number
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

function parseSkuList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => Boolean(x))
  }
  const rec = asRecord(raw)
  if (!rec) return []
  const nested =
    rec.ae_item_sku_info_d_t_o ??
    rec.ae_item_sku_info_dto ??
    rec.ae_item_sku_info ??
    rec.sku_info
  if (Array.isArray(nested)) {
    return nested.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => Boolean(x))
  }
  const one = asRecord(nested)
  return one ? [one] : []
}

function parsePriceEur(sku: Record<string, unknown>, result: Record<string, unknown>): number {
  const fromSku =
    pickString(sku, [
      "offer_sale_price",
      "sku_price",
      "target_offer_sale_price",
      "sale_price",
      "price",
    ]) ||
    String(sku.offer_sale_price ?? sku.sku_price ?? sku.target_offer_sale_price ?? "")

  const fromResult = pickString(result, ["target_sale_price", "sale_price", "product_price"])
  const raw = fromSku || fromResult
  const n = Number(String(raw).replace(/[^\d.,]/g, "").replace(",", "."))
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

function parseSkuProperties(sku: Record<string, unknown>): { color: string | null; size: string | null; label: string } {
  const parts: string[] = []
  let color: string | null = null
  let size: string | null = null

  const rawProps =
    sku.ae_sku_property_dtos ??
    sku.ae_sku_property_dto ??
    sku.sku_property_list ??
    sku.sku_props

  const propList = Array.isArray(rawProps) ? rawProps : rawProps ? [rawProps] : []

  for (const p of propList) {
    const rec = asRecord(p)
    if (!rec) continue
    const name = pickString(rec, [
      "sku_property_name",
      "property_name",
      "name",
      "spec_name",
    ]).toLowerCase()
    const value = pickString(rec, [
      "sku_property_value",
      "property_value",
      "value",
      "spec_value",
      "property_value_definition_name",
    ])
    if (!value) continue
    parts.push(value)
    if (!color && (name.includes("color") || name.includes("couleur") || name === "color")) {
      color = value
    }
    if (!size && (name.includes("size") || name.includes("taille"))) {
      size = value
    }
  }

  if (!color && parts.length === 1) {
    color = parts[0] ?? null
  }

  const label = parts.length > 0 ? parts.join(" · ") : pickString(sku, ["sku_attr", "sku_code"]) || "SKU"

  return { color, size, label }
}

/** Parse all SKUs from `aliexpress.ds.product.get` payload. */
export function parseAeProductSkusFromPayload(payload: unknown, aeProductId: string): AeProductSkuRow[] {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}

  const skus = parseSkuList(
    result.ae_item_sku_info_dtos ??
      result.ae_item_sku_info_dto ??
      result.sku_info ??
      result.skus
  )

  const rows: AeProductSkuRow[] = []

  for (const sku of skus) {
    const aeSkuId =
      pickString(sku, ["sku_id", "skuId", "ae_sku_id", "id"]) ||
      (sku.sku_id != null ? String(sku.sku_id) : "")
    if (!aeSkuId) continue

    const { color, size, label } = parseSkuProperties(sku)
    const priceEur = parsePriceEur(sku, result)
    const stockRaw = sku.sku_available_stock ?? sku.available_stock ?? sku.stock
    const stock = Math.max(0, Math.round(Number(stockRaw)) || 0)

    rows.push({
      aeSkuId,
      aeLabel: label,
      matchColor: color ? canonicalVariantColorKey(color) : null,
      matchSize: size?.trim() || null,
      aePriceCents: priceEur > 0 ? Math.max(100, Math.round(priceEur * 100)) : 0,
      stock,
    })
  }

  if (rows.length === 0) {
    try {
      const mapped = mapAliExpressGetProductResponse(payload, aeProductId)
      rows.push({
        aeSkuId: "",
        aeLabel: "Défaut",
        matchColor: null,
        matchSize: null,
        aePriceCents: mapped.basePriceCents,
        stock: mapped.stock,
      })
    } catch {
      /* no skus */
    }
  }

  return rows
}
