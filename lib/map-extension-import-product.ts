/**
 * Maps `/api/supplier/import-url` product payload to `executeSupplierProductsImport` row shape.
 */
export function mapScrapedProductForImportSave(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  const price = num(raw.price)
  const suggested =
    num(raw.suggested_price) > 0 ? num(raw.suggested_price) : price > 0 ? price * 2.5 : 0

  const images = Array.isArray(raw.images)
    ? raw.images.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : []

  return {
    title,
    name: title,
    price,
    original_price: num(raw.original_price) || price,
    suggested_price: suggested,
    suggested_commission: num(raw.suggested_commission) || 25,
    profit_per_sale:
      typeof raw.profit_per_sale === "number"
        ? raw.profit_per_sale.toFixed(2)
        : Math.max(0, suggested - price).toFixed(2),
    basePrice: num(raw.basePrice) || suggested,
    currency: typeof raw.currency === "string" ? raw.currency : "EUR",
    images,
    image: images[0] ?? "",
    description: typeof raw.description === "string" ? raw.description : "",
    variants: raw.variants ?? [],
    colors: raw.colors ?? [],
    sizes: raw.sizes ?? [],
    sizes_objects: raw.sizes ?? [],
    shipping: raw.shipping ?? {
      from_country: "China",
      delivery_time: "15–25 days",
      shipping_cost: 0,
      processing_time: "1–3 days",
    },
    specs: raw.specs ?? {},
    tags: raw.tags ?? [],
    stock: Math.max(0, Math.round(num(raw.stock) || 99)),
    sku: typeof raw.sku === "string" ? raw.sku : "",
    source_url: typeof raw.source_url === "string" ? raw.source_url : "",
    category: typeof raw.category === "string" ? raw.category : "",
    reviews: raw.reviews,
    status: "draft",
  }
}

function num(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const n = parseFloat(String(raw ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}
