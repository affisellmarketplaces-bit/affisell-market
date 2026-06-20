import type { AutoDsConfig } from "@/lib/autods/config"
import type { AutoDsCreateOrderPayload } from "@/lib/autods/types"

type ShippingAddress = {
  name?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  postalCode?: string
  country?: string
  phone?: string
}

type BuildArgs = {
  order: {
    id: string
    quantity: number
    variantLabel: string | null
    customerEmail: string
    customerPhone: string | null
    sellingPriceCents: number
    shippingAddress: unknown
  }
  product: {
    name: string
    sourceProductId: string | null
    sourceSkuId: string | null
    sourceUrl: string | null
    supplierSku: string | null
    supplierWholesaleCents: number | null
    basePriceCents: number
    importSource: string | null
  }
  config: AutoDsConfig
}

function parseShipping(raw: unknown): ShippingAddress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as ShippingAddress
}

function splitPersonName(full: string): { first: string; last: string } {
  const trimmed = full.trim()
  if (!trimmed) return { first: "Customer", last: "." }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { first: parts[0]!, last: "." }
  return { first: parts[0]!, last: parts.slice(1).join(" ") }
}

export function resolveAutoDsProductId(product: BuildArgs["product"]): string | null {
  const explicit = product.sourceProductId?.trim()
  if (!explicit) return null
  if (product.importSource?.trim().toLowerCase() === "autods") return explicit
  if (process.env.AUTODS_ALLOW_ANY_SOURCE_PRODUCT_ID === "1") return explicit
  return null
}

export function orderEligibleForAutoDs(product: BuildArgs["product"]): boolean {
  return resolveAutoDsProductId(product) != null
}

export function buildAutoDsCreateOrderPayload(args: BuildArgs): AutoDsCreateOrderPayload {
  const ship = parseShipping(args.order.shippingAddress)
  const { first, last } = splitPersonName(ship.name ?? "")
  const autodsProductId = resolveAutoDsProductId(args.product)
  if (!autodsProductId) {
    throw new Error("autods_product_id_missing")
  }

  const wholesaleCents =
    args.product.supplierWholesaleCents != null && args.product.supplierWholesaleCents > 0
      ? args.product.supplierWholesaleCents
      : args.product.basePriceCents
  const suggestedBuyPrice = Math.max(0.01, wholesaleCents / 100)

  const buyItemRealId =
    args.product.supplierSku?.trim() ||
    args.product.sourceSkuId?.trim() ||
    autodsProductId

  return {
    sell_site_order_id: args.order.id,
    store_name: args.config.storeName,
    first_name: first,
    last_name: last,
    city: ship.city?.trim() || "Unknown",
    zip_code: (ship.postal_code ?? ship.postalCode)?.trim() || "00000",
    country: ship.country?.trim()?.toUpperCase() || "FR",
    buy_site_id: args.config.buySiteId,
    quantity_to_buy: Math.max(1, args.order.quantity),
    buy_item_real_id: buyItemRealId,
    buy_item_variant: args.order.variantLabel?.trim() || "",
    product_title: args.product.name.trim() || "Affisell order",
    suggested_buy_price: suggestedBuyPrice,
    store_id: args.config.storeId,
    buy_item_url: args.product.sourceUrl?.trim() || "https://affisell.com",
    supplier: args.config.supplier,
    region: args.config.region,
    autods_product_id: autodsProductId,
    address1: ship.line1?.trim() || "Address pending",
    address2: ship.line2?.trim() || null,
    state: ship.state?.trim() || null,
    phone_number: args.order.customerPhone?.trim() || ship.phone?.trim() || null,
  }
}

export function extractAutoDsOrderId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const o = body as Record<string, unknown>
  const nested = o.order
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const id = (nested as Record<string, unknown>).id
    if (typeof id === "number" || typeof id === "string") return String(id)
  }
  for (const key of ["id", "order_id"] as const) {
    const v = o[key]
    if (typeof v === "number" || typeof v === "string") return String(v)
  }
  return null
}

export function mapAutoDsRemoteStatus(body: unknown): string {
  if (!body || typeof body !== "object") return "PROCESSING"
  const o = body as Record<string, unknown>
  const nested = o.order
  const raw =
    (nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>).status
      : null) ?? o.status
  if (typeof raw !== "string" || !raw.trim()) return "PROCESSING"
  return raw.trim().toUpperCase()
}
