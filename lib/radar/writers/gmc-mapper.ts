import type { NormalizedStandardProduct } from "@/lib/radar/writers/standard-product-normalize"

export type GmcFeedRow = {
  id: string
  title: string
  description: string
  link: string
  image_link: string
  availability: string
  price: string
  brand: string
  condition: string
  gtin: string
  mpn: string
}

export const GMC_FEED_COLUMNS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "availability",
  "price",
  "brand",
  "condition",
  "gtin",
  "mpn",
] as const

export function gmcFeedId(product: Pick<NormalizedStandardProduct, "marketplaceId" | "externalId" | "country">): string {
  return `${product.marketplaceId}:${product.externalId}:${product.country}`
}

export function toGmcFeedRow(product: NormalizedStandardProduct): GmcFeedRow {
  const price =
    product.price > 0
      ? `${product.price.toFixed(2)} ${product.currency}`
      : `0.00 ${product.currency}`

  return {
    id: gmcFeedId(product),
    title: product.title,
    description: product.description,
    link: product.link,
    image_link: product.imageUrl,
    availability: product.availability,
    price,
    brand: product.brand,
    condition: product.condition,
    gtin: product.gtin,
    mpn: product.mpn,
  }
}

function escapeTsv(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ").trim()
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Map StandardProduct[] → GMC primary feed rows.
 * id = marketplaceId:externalId:country
 */
export function toStandardGMCFeed(
  products: NormalizedStandardProduct[],
  format: "tsv" | "csv" = "tsv"
): string {
  const rows = products.map(toGmcFeedRow)
  const header = GMC_FEED_COLUMNS.join(format === "csv" ? "," : "\t")
  const lines = rows.map((row) => {
    const cells = GMC_FEED_COLUMNS.map((col) => row[col])
    if (format === "csv") {
      return cells.map(escapeCsv).join(",")
    }
    return cells.map(escapeTsv).join("\t")
  })
  return [header, ...lines].join("\n")
}
