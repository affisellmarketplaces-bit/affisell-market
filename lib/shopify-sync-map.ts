/** Normalize user input to `store.myshopify.com` host (no path, no protocol). */
export function normalizeShopifyAdminHost(input: string): string | null {
  let s = input.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, "")
  s = s.split("/")[0] ?? ""
  if (!s) return null
  if (!s.includes(".") && /^[a-z0-9-]+$/.test(s)) s = `${s}.myshopify.com`
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(s)) return null
  return s
}

const HTML_TAG = /<[^>]+>/g

function stripHtml(html: string): string {
  return html.replace(HTML_TAG, " ").replace(/\s+/g, " ").trim()
}

function num(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const n = parseFloat(String(raw ?? "").replace(/\s+/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

/**
 * Map a Shopify Admin REST `Product` JSON object into one row for
 * `executeSupplierProductsImport` / bulk import API.
 */
export function shopifyProductToImportRow(
  product: Record<string, unknown>,
  shopHost: string
): Record<string, unknown> {
  const title = String(product.title ?? "").trim()
  const bodyHtml = typeof product.body_html === "string" ? product.body_html : ""
  const description = stripHtml(bodyHtml)

  const images: string[] = []
  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (!img || typeof img !== "object" || Array.isArray(img)) continue
      const src = (img as Record<string, unknown>).src
      if (typeof src === "string" && src.trim() && !src.startsWith("blob:"))
        images.push(src.trim())
      if (images.length >= 10) break
    }
  }

  const variants = Array.isArray(product.variants) ? product.variants : []
  const v0 =
    variants[0] && typeof variants[0] === "object" && !Array.isArray(variants[0])
      ? (variants[0] as Record<string, unknown>)
      : {}

  const price = num(v0.price)
  const inv = Number(v0.inventory_quantity)
  const stock =
    Number.isFinite(inv) && inv >= 0 ? Math.max(0, Math.round(inv)) : 0

  const handle =
    typeof product.handle === "string" ? product.handle.trim() : ""
  const shopifyProductId =
    product.id != null ? String(product.id).replace(/\D/g, "").slice(0, 32) : ""
  const skuFromVariant =
    typeof v0.sku === "string" && v0.sku.trim() ? v0.sku.trim().slice(0, 80) : ""
  const sku =
    shopifyProductId.length > 0
      ? `sfy-pid-${shopifyProductId}`.slice(0, 80)
      : skuFromVariant ||
        (handle ? `sfy-${handle}`.slice(0, 80) : `sfy-${Date.now()}`)

  const productType =
    typeof product.product_type === "string"
      ? product.product_type.trim().slice(0, 120)
      : ""

  const sourceUrl =
    handle && shopHost
      ? `https://${shopHost}/products/${handle}`
      : `https://${shopHost}/admin`

  return {
    title,
    description: description || title,
    images,
    price: price > 0 ? price : 0,
    suggested_price: price > 0 ? price : 0,
    stock,
    sku,
    category: productType || "Shopify",
    shipping: {
      from_country: "Shopify",
      delivery_time: "5-10 days",
      shipping_cost: 0,
    },
    source_url: sourceUrl,
    status: "draft",
    tags: ["shopify-sync"],
    shopify_product_id: shopifyProductId,
    import_source: "shopify",
  }
}

export const DEFAULT_SHOPIFY_API_VERSION = "2024-07"
