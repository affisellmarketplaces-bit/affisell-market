import "server-only"

/**
 * BigBuy product lookup for DropForge (paste a URL, preview a product) — Affisell's own
 * BigBuy API key, not a supplier-specific credential (BigBuy issues one key per account,
 * requested via their contact form: https://www.bigbuy.eu/en/api_bigbuy.html).
 *
 * Built from BigBuy's official API guide (bigbuy.eu/public/doc/Guia_API_BigBuy_EN.pdf) and
 * their published OpenAPI spec (github.com/shopiqo/bigbuy-oas) — not yet exercised against
 * a live account (no BigBuy credentials available in this environment). Verify against a
 * real/sandbox account before relying on it for a supplier-facing import.
 *
 * Unlike 1688/CJ, BigBuy prices are already EUR — confirmed live against their own
 * storefront JSON-LD ("priceCurrency":"EUR") — so no currency conversion is needed here.
 *
 * Auth is a single static Bearer token (no login/token-exchange step, unlike CJ), but each
 * endpoint is rate-limited to 1 request per 5 seconds per BigBuy's own API spec — a full
 * product lookup needs 3 calls (core fields, text, images) against 3 *different* endpoints,
 * so they're only rate-limited against themselves, not each other; called sequentially here
 * anyway to stay gentle rather than firing them in parallel.
 */

const BIGBUY_API_BASE = "https://api.bigbuy.eu"
const REQUEST_TIMEOUT_MS = 15_000

const PRODUCT_ID_RE = /_(\d+)(?:[/?#]|$)/

export function extractBigBuyProductId(url: string): string | null {
  const match = PRODUCT_ID_RE.exec(String(url ?? "").split(/[?#]/)[0] ?? "")
  return match ? match[1]! : null
}

function bigBuyApiKey(): string | null {
  const key = process.env.BIGBUY_API_KEY?.trim()
  return key || null
}

async function bigBuyGet<T>(path: string): Promise<T> {
  const key = bigBuyApiKey()
  if (!key) {
    throw new Error(
      "BIGBUY_API_KEY manquante (.env.local) — demandez une clé API BigBuy via leur formulaire de contact (bigbuy.eu/en/api_bigbuy.html)."
    )
  }
  const res = await fetch(`${BIGBUY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`BigBuy ${path} failed (${res.status}): ${body.slice(0, 200) || "unknown"}`)
  }
  return (await res.json()) as T
}

type BigBuyProduct = {
  id?: number
  sku?: string
  wholesalePrice?: number
  retailPrice?: number
  category?: number
  taxRate?: number
}

type BigBuyProductInformation = {
  id?: number
  sku?: string
  name?: string
  description?: string
  url?: string
}

type BigBuyProductImages = {
  id?: number
  images?: Array<{ id?: number; isCover?: boolean | string; url?: string }>
}

export type BigBuyProductResult = {
  name: string
  description: string
  /** EUR — BigBuy's API is EUR-only (confirmed against their storefront JSON-LD). */
  priceEur: number
  images: string[]
  sku: string
  source: string
}

/** Fetches a BigBuy product by its detail-page URL via the official singular product endpoints. */
export async function getBigBuyProduct(url: string): Promise<BigBuyProductResult> {
  const id = extractBigBuyProductId(url)
  if (!id) {
    throw new Error("URL BigBuy invalide — attendu …/shop/product/<nom>_<id>")
  }

  const core = await bigBuyGet<BigBuyProduct>(`/rest/catalog/product/${id}.json`)
  const info = await bigBuyGet<BigBuyProductInformation>(
    `/rest/catalog/productinformation/${id}.json?isoCode=en`
  )
  const imagesData = await bigBuyGet<BigBuyProductImages>(`/rest/catalog/productimages/${id}.json`)

  const name = String(info.name ?? "").trim()
  if (!name) {
    throw new Error("BigBuy: produit introuvable ou sans nom")
  }

  const priceRaw = core.wholesalePrice ?? core.retailPrice ?? 0
  const priceEur = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : 0

  const images = (imagesData.images ?? [])
    .map((img) => (typeof img.url === "string" ? img.url : ""))
    .filter(Boolean)

  return {
    name,
    description: String(info.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    priceEur,
    images,
    sku: String(core.sku ?? info.sku ?? "").trim(),
    source: `https://www.bigbuy.eu/en/shop/product/${info.url ?? id}`,
  }
}
