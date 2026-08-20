import { IntegrationProvider } from "@prisma/client"

import { decryptIntegrationSecret } from "@/lib/integrations/crypto"
import { normalizeWooShopDomain } from "@/lib/integrations/woo-domain"
import type {
  CanonicalProduct,
  IntegrationProviderAdapter,
  IntegrationRow,
} from "@/lib/integrations/types"

export type WooStoredCredentials = {
  ck: string
  cs: string
}

export type WooApiKeyAuthParams = {
  shopDomain: string
  consumerKey: string
  consumerSecret: string
}

export type WooApiKeyAuthResult =
  | { success: true; shopDomain: string }
  | { error: string }

type WooRestProduct = {
  id: number | string
  name?: string
  slug?: string
  description?: string
  short_description?: string
  price?: string
  regular_price?: string
  stock_quantity?: number | null
  stock_status?: string
  images?: Array<{ src?: string; alt?: string }>
  categories?: Array<{ name?: string }>
  variations?: number[]
}

const MAX_PAGES = 50
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300

function basicAuthHeader(consumerKey: string, consumerSecret: string): string {
  return `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`, "utf8").toString("base64")}`
}

function parseStoredCredentials(accessTokenEncrypted: string): WooStoredCredentials {
  const parsed = JSON.parse(decryptIntegrationSecret(accessTokenEncrypted)) as WooStoredCredentials
  if (!parsed?.ck?.trim() || !parsed?.cs?.trim()) {
    throw new Error("Invalid WooCommerce credentials payload")
  }
  return { ck: parsed.ck.trim(), cs: parsed.cs.trim() }
}

function mapWooProduct(p: WooRestProduct): CanonicalProduct | null {
  const title = typeof p.name === "string" ? p.name.trim() : ""
  const externalId = p.id != null ? String(p.id) : ""
  if (!title || !externalId) return null

  const priceCents = Math.max(0, Math.round(Number.parseFloat(p.price ?? "0") * 100))
  const compareAt = p.regular_price
    ? Math.max(0, Math.round(Number.parseFloat(p.regular_price) * 100))
    : undefined

  let inventoryQuantity = 0
  if (typeof p.stock_quantity === "number" && Number.isFinite(p.stock_quantity)) {
    inventoryQuantity = Math.max(0, Math.round(p.stock_quantity))
  } else if (p.stock_status === "instock") {
    inventoryQuantity = 100
  }

  const images = (p.images ?? [])
    .map((img) => ({
      url: typeof img.src === "string" ? img.src : "",
      alt: typeof img.alt === "string" ? img.alt : title,
    }))
    .filter((img) => img.url)

  return {
    externalId,
    title: title.slice(0, 500),
    descriptionHtml: (p.description || p.short_description || title).slice(0, 8000),
    handle: typeof p.slug === "string" && p.slug.trim() ? p.slug : externalId,
    vendor: undefined,
    productType: p.categories?.[0]?.name?.slice(0, 120) ?? "WooCommerce",
    priceCents,
    compareAtPriceCents: compareAt,
    inventoryQuantity,
    images,
    variants: [],
    options: [],
    raw: p as unknown as Record<string, unknown>,
  }
}

/** Validate REST API keys against WooCommerce — no OAuth. */
export async function validateWooApiKeys(
  params: WooApiKeyAuthParams
): Promise<WooApiKeyAuthResult> {
  const shopDomain = normalizeWooShopDomain(params.shopDomain)
  if (!shopDomain) {
    return { error: "Invalid store URL — use https://your-store.com (http OK for tastewp/localhost)" }
  }

  const consumerKey = params.consumerKey.trim()
  const consumerSecret = params.consumerSecret.trim()
  if (consumerKey.length < 8 || consumerSecret.length < 8) {
    return { error: "Consumer key and secret are required" }
  }

  const url = `${shopDomain}/wp-json/wc/v3/products?per_page=1&status=publish`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: basicAuthHeader(consumerKey, consumerSecret),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.log("[woo-sync]", {
        shopDomain,
        result: "auth_failed",
        status: res.status,
      })
      return {
        error: `Woo auth failed (${res.status}): ${text.slice(0, 200) || res.statusText}`,
      }
    }

    console.log("[woo-sync]", { shopDomain, result: "auth_ok" })
    return { success: true, shopDomain }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Woo auth request failed: ${msg}` }
  }
}

export class WooIntegrationProvider implements IntegrationProviderAdapter {
  readonly provider = IntegrationProvider.WOOCOMMERCE

  /** OAuth not used — see validateWooApiKeys + POST /api/integrations/woo/auth */
  async authenticate(): Promise<{ error: string }> {
    return { error: "WOO_USE_API_KEYS" }
  }

  async fetchProducts(integration: IntegrationRow): Promise<CanonicalProduct[]> {
    if (!integration.shopDomain?.trim()) {
      throw new Error("WooCommerce shop domain missing")
    }
    if (!integration.accessTokenEncrypted) {
      throw new Error("WooCommerce credentials missing")
    }

    const base = integration.shopDomain.replace(/\/$/, "")
    const creds = parseStoredCredentials(integration.accessTokenEncrypted)
    const all: CanonicalProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${base}/wp-json/wc/v3/products?per_page=${PAGE_SIZE}&page=${page}&status=publish`
      const res = await fetch(url, {
        headers: {
          Authorization: basicAuthHeader(creds.ck, creds.cs),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        throw new Error(`Woo fetch failed (${res.status})`)
      }

      const products = (await res.json()) as WooRestProduct[]
      if (!Array.isArray(products) || products.length === 0) break

      for (const p of products) {
        const mapped = mapWooProduct(p)
        if (mapped) all.push(mapped)
      }

      if (products.length < PAGE_SIZE) break
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS))
    }

    console.log("[woo-sync]", {
      integrationId: integration.id,
      supplierId: integration.userId,
      fetched: all.length,
      result: "catalog_fetched",
    })

    return all
  }

  async disconnect(): Promise<void> {
    return
  }
}
