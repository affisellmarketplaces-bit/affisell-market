import "server-only"

/** Line item stored on TikTokOrder.skuList */
export type TikTokOrderSkuLine = {
  sku: string
  productId?: string
  title?: string
  qty: number
  unitPrice: number
  imageUrl?: string
}

export type TikTokOrderMapped = {
  orderId: string
  status: string | null
  orderStatus: string | null
  orderCreatedAt: Date | null
  totalAmount: number | null
  currency: string | null
  skuList: TikTokOrderSkuLine[]
  shippingFee: number | null
  productFee: number | null
  platformFee: number | null
  customerInfo: { country?: string; zipPrefix?: string } | null
  raw: Record<string, unknown>
}

const CANCELLED = new Set(["140", "CANCELLED", "cancelled", "CANCELED", "canceled"])

export function isTikTokOrderCancelled(status: string | null | undefined): boolean {
  if (!status) return false
  return CANCELLED.has(String(status).trim())
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

function parseMoney(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim())
    return Number.isFinite(n) ? n : null
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    return parseMoney(o.amount ?? o.value ?? o.price ?? o.cent_amount)
  }
  return null
}

function parseUnix(v: unknown): Date | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : Number(String(v).trim())
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n > 10_000_000_000 ? n : n * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

function anonymizeCustomer(raw: Record<string, unknown>): {
  country?: string
  zipPrefix?: string
} | null {
  const recipient =
    asRecord(raw.recipient_address) ??
    asRecord(raw.shipping_address) ??
    asRecord(raw.buyer_message) ??
    null
  const country =
    (recipient?.region_code != null
      ? String(recipient.region_code)
      : recipient?.country != null
        ? String(recipient.country)
        : raw.buyer_country != null
          ? String(raw.buyer_country)
          : undefined) ?? undefined
  const zipRaw =
    recipient?.postal_code != null
      ? String(recipient.postal_code)
      : recipient?.zipcode != null
        ? String(recipient.zipcode)
        : undefined
  const zipPrefix = zipRaw ? zipRaw.replace(/\s+/g, "").slice(0, 3) : undefined
  if (!country && !zipPrefix) return null
  return { ...(country ? { country } : {}), ...(zipPrefix ? { zipPrefix } : {}) }
}

function mapLineItems(raw: Record<string, unknown>): TikTokOrderSkuLine[] {
  const list =
    (raw.line_items as unknown[]) ??
    (raw.item_list as unknown[]) ??
    (raw.order_line_list as unknown[]) ??
    (raw.sku_list as unknown[]) ??
    []
  if (!Array.isArray(list)) return []

  const out: TikTokOrderSkuLine[] = []
  for (const row of list) {
    const item = asRecord(row)
    if (!item) continue
    const sku = String(
      item.seller_sku ?? item.sku_id ?? item.sku ?? item.product_id ?? item.id ?? ""
    ).trim()
    if (!sku) continue
    const qtyRaw = item.quantity ?? item.sku_quantity ?? item.qty ?? 1
    const qty = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw) || 1
    const unitPrice =
      parseMoney(item.sale_price) ??
      parseMoney(item.sku_sale_price) ??
      parseMoney(item.price) ??
      parseMoney(item.original_price) ??
      0
    const imageUrl =
      item.sku_image != null
        ? String(item.sku_image)
        : item.product_image != null
          ? String(item.product_image)
          : undefined
    out.push({
      sku,
      productId: item.product_id != null ? String(item.product_id) : undefined,
      title:
        item.product_name != null
          ? String(item.product_name)
          : item.sku_name != null
            ? String(item.sku_name)
            : undefined,
      qty,
      unitPrice,
      imageUrl,
    })
  }
  return out
}

/**
 * Map TikTok Shop order detail payload → denormalized Radar row.
 */
export function mapTikTokOrderPayload(raw: Record<string, unknown>): TikTokOrderMapped {
  const orderId = String(raw.order_id ?? raw.id ?? "").trim()
  const statusRaw = raw.order_status ?? raw.status
  const status = statusRaw != null ? String(statusRaw) : null

  const payment =
    asRecord(raw.payment) ?? asRecord(raw.payment_info) ?? asRecord(raw.price_detail) ?? {}

  const totalAmount =
    parseMoney(payment.total_amount) ??
    parseMoney(raw.payment_amount) ??
    parseMoney(raw.total_amount) ??
    parseMoney(payment.original_total_product_price)

  const currency =
    (payment.currency != null
      ? String(payment.currency)
      : raw.currency != null
        ? String(raw.currency)
        : null) ?? null

  const shippingFee =
    parseMoney(payment.shipping_fee) ??
    parseMoney(payment.original_shipping_fee) ??
    parseMoney(raw.shipping_fee)

  const productFee =
    parseMoney(payment.sub_total) ??
    parseMoney(payment.original_total_product_price) ??
    parseMoney(payment.product_price)

  const platformFee =
    parseMoney(payment.platform_discount) ??
    parseMoney(payment.seller_discount) ??
    parseMoney(raw.platform_fee) ??
    parseMoney(payment.fee)

  return {
    orderId,
    status,
    orderStatus: status,
    orderCreatedAt: parseUnix(raw.create_time ?? raw.created_at ?? raw.create_time_ms),
    totalAmount,
    currency,
    skuList: mapLineItems(raw),
    shippingFee,
    productFee,
    platformFee,
    customerInfo: anonymizeCustomer(raw),
    raw,
  }
}
