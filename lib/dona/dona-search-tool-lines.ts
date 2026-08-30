import type { DonaProductHit, DonaSearchToolResult } from "@/lib/dona/dona-product-types"

export function encodeDonaSearchRow(p: DonaProductHit, group: 0 | 1): string {
  return JSON.stringify({
    g: group,
    listingId: p.listingId,
    productId: p.productId,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    brand: p.brand,
    url: p.url,
  })
}

export function buildDonaSearchToolLines(result: DonaSearchToolResult): string[] {
  const lines: string[] = []
  for (const p of result.products) {
    lines.push(encodeDonaSearchRow(p, 0))
  }
  for (const p of result.similarProducts) {
    lines.push(encodeDonaSearchRow(p, 1))
  }
  if (lines.length === 0 && result.suggestedCategories.length > 0) {
    for (const c of result.suggestedCategories) {
      lines.push(JSON.stringify({ t: "cat", c }))
    }
  }
  return lines
}

export function parseDonaSearchRow(o: Record<string, unknown>): DonaProductHit | null {
  if (
    typeof o.listingId !== "string" ||
    typeof o.productId !== "string" ||
    typeof o.name !== "string" ||
    typeof o.price !== "number"
  ) {
    return null
  }
  const url =
    typeof o.url === "string" && o.url.startsWith("/marketplace/")
      ? o.url
      : `/marketplace/${o.listingId}`
  return {
    listingId: o.listingId,
    productId: o.productId,
    name: o.name,
    price: o.price,
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : null,
    brand: typeof o.brand === "string" ? o.brand : "Affisell",
    url,
  }
}

export function parseDonaSearchToolOutput(raw: unknown): DonaSearchToolResult | null {
  if (!Array.isArray(raw)) return null

  const products: DonaProductHit[] = []
  const similarProducts: DonaProductHit[] = []
  const suggestedCategories: string[] = []

  for (const line of raw) {
    if (typeof line !== "string") continue
    try {
      const o = JSON.parse(line) as Record<string, unknown>
      if (o.t === "cat" && typeof o.c === "string") {
        suggestedCategories.push(o.c)
        continue
      }
      const card = parseDonaSearchRow(o)
      if (!card) continue
      if (o.g === 1) similarProducts.push(card)
      else products.push(card)
    } catch {
      /* skip bad line */
    }
  }

  return {
    products: products.slice(0, 3),
    similarProducts: similarProducts.slice(0, 3),
    suggestedCategories,
  }
}
