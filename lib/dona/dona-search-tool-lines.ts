import type { DonaProductHit, DonaProductToolResult } from "@/lib/dona/dona-product-types"

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
    rank: p.rank,
    soldCount: p.soldCount,
  })
}

export function buildDonaSearchToolLines(result: DonaProductToolResult): string[] {
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
    rank: typeof o.rank === "number" ? o.rank : undefined,
    soldCount: typeof o.soldCount === "number" ? o.soldCount : undefined,
  }
}

const EMPTY_TOOL_RESULT: DonaProductToolResult = {
  products: [],
  similarProducts: [],
  suggestedCategories: [],
  hubUrl: null,
  hubWindow: null,
}

export function parseDonaProductToolOutput(raw: unknown): DonaProductToolResult {
  if (!Array.isArray(raw)) return { ...EMPTY_TOOL_RESULT }

  const products: DonaProductHit[] = []
  const similarProducts: DonaProductHit[] = []
  const suggestedCategories: string[] = []
  let hubUrl: string | null = null
  let hubWindow: string | null = null
  const seenListing = new Set<string>()

  const pushProduct = (card: DonaProductHit, group: number) => {
    if (seenListing.has(card.listingId)) return
    seenListing.add(card.listingId)
    if (group === 1) similarProducts.push(card)
    else products.push(card)
  }

  for (const line of raw) {
    if (typeof line !== "string") continue
    try {
      const o = JSON.parse(line) as Record<string, unknown>
      if (o.t === "hub" && typeof o.url === "string") {
        hubUrl = o.url
        hubWindow = typeof o.window === "string" ? o.window : null
        continue
      }
      if (o.t === "cat" && typeof o.c === "string") {
        suggestedCategories.push(o.c)
        continue
      }
      const card = parseDonaSearchRow(o)
      if (!card) continue
      pushProduct(card, o.g === 1 ? 1 : 0)
    } catch {
      /* skip bad line */
    }
  }

  return {
    products: products.slice(0, 5),
    similarProducts: similarProducts.slice(0, 3),
    suggestedCategories,
    hubUrl,
    hubWindow,
  }
}

/** @deprecated use parseDonaProductToolOutput */
export function parseDonaSearchToolOutput(raw: unknown): DonaProductToolResult | null {
  const parsed = parseDonaProductToolOutput(raw)
  if (
    parsed.products.length === 0 &&
    parsed.similarProducts.length === 0 &&
    parsed.suggestedCategories.length === 0 &&
    !parsed.hubUrl
  ) {
    return null
  }
  return parsed
}

export function mergeDonaProductToolResults(results: DonaProductToolResult[]): DonaProductToolResult {
  const merged: DonaProductToolResult = { ...EMPTY_TOOL_RESULT, products: [], similarProducts: [] }
  const seenMain = new Set<string>()
  const seenSimilar = new Set<string>()

  for (const result of results) {
    if (result.hubUrl) {
      merged.hubUrl = result.hubUrl
      merged.hubWindow = result.hubWindow ?? merged.hubWindow
    }
    for (const c of result.suggestedCategories) {
      if (!merged.suggestedCategories.includes(c)) merged.suggestedCategories.push(c)
    }
    for (const p of result.products) {
      if (seenMain.has(p.listingId)) continue
      seenMain.add(p.listingId)
      merged.products.push(p)
    }
    for (const p of result.similarProducts) {
      if (seenSimilar.has(p.listingId) || seenMain.has(p.listingId)) continue
      seenSimilar.add(p.listingId)
      merged.similarProducts.push(p)
    }
  }

  merged.products.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  merged.products = merged.products.slice(0, 5)
  merged.similarProducts = merged.similarProducts.slice(0, 3)
  merged.suggestedCategories = merged.suggestedCategories.slice(0, 6)
  return merged
}

export function donaProductToolHasCards(result: DonaProductToolResult): boolean {
  return result.products.length > 0 || result.similarProducts.length > 0
}
