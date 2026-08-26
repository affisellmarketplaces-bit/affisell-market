import { IntegrationProvider } from "@prisma/client"

import type {
  CanonicalProduct,
  IntegrationProviderAdapter,
  IntegrationRow,
} from "@/lib/integrations/types"
import { exchangeShopifyOAuthCode } from "@/lib/supplier-sync/shopify/oauth"
import { verifyShopifyHmac } from "@/lib/supplier-sync/shopify/hmac"
import { resolveShopifyCredentials } from "@/lib/supplier-sync/shopify/credentials"
import { enqueueShopifyRequest } from "@/lib/supplier-sync/queue"
import { DEFAULT_SHOPIFY_API_VERSION } from "@/lib/shopify-sync-map"

const GRAPHQL_PAGE_SIZE = 50
const MAX_PAGES = 40
const API_VERSION = "2024-10"

type GraphQlResponse = {
  data?: Record<string, unknown>
  errors?: Array<{ message: string }>
}

function gidToNumericId(gid: string): string {
  const tail = gid.split("/").pop() ?? gid
  return tail.replace(/\D/g, "") || tail
}

function parseMoneyToCents(value: string | null | undefined): number {
  if (!value) return 0
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

async function shopifyGraphql<T>(
  creds: { shopHost: string; accessToken: string },
  query: string,
  variables: Record<string, unknown>
): Promise<{ ok: true; data: T } | { ok: false; error: string; retryAfterMs?: number }> {
  const url = `https://${creds.shopHost}/admin/api/${API_VERSION}/graphql.json`

  let attempt = 0
  while (attempt < 5) {
    attempt++
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": creds.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2")
      const jitter = Math.floor(Math.random() * 400)
      const waitMs = Math.min(30_000, retryAfter * 1000 + jitter * attempt)
      console.log("[shopify-sync]", {
        result: "rate_limited",
        attempt,
        waitMs,
      })
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `Shopify GraphQL HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    const json = (await res.json()) as GraphQlResponse
    if (json.errors?.length) {
      return { ok: false, error: json.errors.map((e) => e.message).join("; ") }
    }

    return { ok: true, data: json.data as T }
  }

  return { ok: false, error: "Shopify rate limit exceeded after retries" }
}

const PRODUCTS_QUERY = `
  query IntegrationProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          descriptionHtml
          handle
          vendor
          productType
          options {
            name
            values
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                sku
                title
                price
                compareAtPrice
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`

type ProductsQueryData = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    edges: Array<{
      node: Record<string, unknown>
    }>
  }
}

function mapGraphqlProduct(node: Record<string, unknown>): CanonicalProduct | null {
  const title = typeof node.title === "string" ? node.title.trim() : ""
  const gid = typeof node.id === "string" ? node.id : ""
  const externalId = gidToNumericId(gid)
  if (!title || !externalId) return null

  const variantEdges = (
    (node.variants as { edges?: Array<{ node?: Record<string, unknown> }> } | undefined)?.edges ??
    []
  ).map((e) => e.node).filter(Boolean) as Record<string, unknown>[]

  const variants = variantEdges.map((v) => ({
    externalId: gidToNumericId(String(v.id ?? "")),
    sku: typeof v.sku === "string" && v.sku.trim() ? v.sku.trim() : `sfy-v-${gidToNumericId(String(v.id ?? ""))}`,
    title: typeof v.title === "string" ? v.title : "Default",
    priceCents: parseMoneyToCents(typeof v.price === "string" ? v.price : String(v.price ?? "0")),
    compareAtPriceCents: v.compareAtPrice
      ? parseMoneyToCents(String(v.compareAtPrice))
      : undefined,
    inventory: Math.max(0, Math.round(Number(v.inventoryQuantity ?? 0))),
  }))

  const primary = variants[0]
  const inventoryQuantity = variants.reduce((sum, v) => sum + v.inventory, 0)
  const priceCents = primary?.priceCents ?? 0

  const imageEdges = (
    (node.images as { edges?: Array<{ node?: Record<string, unknown> }> } | undefined)?.edges ?? []
  ).map((e) => e.node).filter(Boolean) as Record<string, unknown>[]

  const images = imageEdges
    .map((img) => ({
      url: typeof img.url === "string" ? img.url : "",
      alt: typeof img.altText === "string" ? img.altText : undefined,
    }))
    .filter((img) => img.url)

  const optionsRaw = Array.isArray(node.options) ? node.options : []
  const options = optionsRaw
    .map((o) => {
      if (!o || typeof o !== "object" || Array.isArray(o)) return null
      const rec = o as Record<string, unknown>
      const name = typeof rec.name === "string" ? rec.name : ""
      const values = Array.isArray(rec.values)
        ? rec.values.filter((v): v is string => typeof v === "string")
        : []
      return name ? { name, values } : null
    })
    .filter(Boolean) as Array<{ name: string; values: string[] }>

  return {
    externalId,
    title: title.slice(0, 500),
    descriptionHtml:
      (typeof node.descriptionHtml === "string" ? node.descriptionHtml : title).slice(0, 8000),
    handle: typeof node.handle === "string" ? node.handle : externalId,
    vendor: typeof node.vendor === "string" ? node.vendor : undefined,
    productType: typeof node.productType === "string" ? node.productType : undefined,
    priceCents,
    compareAtPriceCents: primary?.compareAtPriceCents,
    inventoryQuantity,
    images,
    variants,
    options,
    raw: node,
  }
}

export class ShopifyIntegrationProvider implements IntegrationProviderAdapter {
  readonly provider = IntegrationProvider.SHOPIFY

  async authenticate(args: { shop: string; code: string }) {
    const out = await exchangeShopifyOAuthCode(args)
    if ("error" in out) return { error: out.error }
    return {
      accessToken: out.accessToken,
      scope: out.scope,
      shopDomain: args.shop,
    }
  }

  async fetchProducts(integration: IntegrationRow): Promise<CanonicalProduct[]> {
    const creds = resolveShopifyCredentials(integration)
    if (!creds) {
      throw new Error("Invalid Shopify credentials")
    }

    const products: CanonicalProduct[] = []
    let after: string | null = null

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await enqueueShopifyRequest(() =>
        shopifyGraphql<ProductsQueryData>(creds, PRODUCTS_QUERY, {
          first: GRAPHQL_PAGE_SIZE,
          after,
        })
      )

      if (!result.ok) {
        throw new Error(result.error)
      }

      const connection = result.data.products
      for (const edge of connection.edges) {
        const mapped = mapGraphqlProduct(edge.node)
        if (mapped) products.push(mapped)
      }

      if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break
      after = connection.pageInfo.endCursor
    }

    console.log("[shopify-sync]", {
      integrationId: integration.id,
      supplierId: integration.userId,
      fetched: products.length,
      apiVersion: creds.apiVersion ?? DEFAULT_SHOPIFY_API_VERSION,
    })

    return products
  }

  verifyWebhook(headers: Headers, rawBody: string, secret: string) {
    const hmac = headers.get("x-shopify-hmac-sha256")
    if (!verifyShopifyHmac({ secret, rawBody, hmacHeader: hmac })) {
      return { ok: false as const, error: "Invalid HMAC" }
    }
    return { ok: true as const }
  }
}
