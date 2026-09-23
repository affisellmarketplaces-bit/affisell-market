import "server-only"

/**
 * CJ Dropshipping product lookup for DropForge (paste a URL, preview a product) — a
 * platform-wide credential (Affisell's own CJ account), not a supplier's connected account.
 * This is deliberately separate from lib/suppliers/adapters/cj-dropshipping.adapter.ts,
 * which is the per-supplier order-placement adapter keyed to a supplier's own CJ
 * credentials (FulfillmentProvider.credentialsEncrypted) — DropForge needs to preview a
 * product before any supplier account or connection exists, mirroring how lib/onebound.js
 * uses one platform-wide OneBound key for 1688 rather than a per-supplier credential.
 *
 * Built from CJ's official v2 API docs (developers.cjdropshipping.cn/en/api/api2/) — not
 * yet exercised against a live account (no CJ credentials available in this environment).
 * Verify against a real account before relying on it for a supplier-facing import.
 */

const CJ_API_BASE = "https://developers.cjdropshipping.com/api2.0/v1"
const REQUEST_TIMEOUT_MS = 20_000
/** CJ rate-limits auth to ~once per 300s per account — cache in-process like the order adapter does. */
const TOKEN_SAFETY_MARGIN_MS = 60_000

const PRODUCT_ID_RE = /-p-(\d+)\.html/i

export function extractCjProductId(url: string): string | null {
  const match = PRODUCT_ID_RE.exec(String(url ?? ""))
  return match ? match[1]! : null
}

type CjEnvelope<T> = { result?: boolean; message?: string; data?: T }

let cachedToken: { accessToken: string; expiresAt: number } | null = null
let inFlightAuth: Promise<string> | null = null

function cjCredentials(): { email: string; apiKey: string } | null {
  const email = process.env.CJ_API_EMAIL?.trim()
  const apiKey = process.env.CJ_API_KEY?.trim()
  if (!email || !apiKey) return null
  return { email, apiKey }
}

async function getCjAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_SAFETY_MARGIN_MS) {
    return cachedToken.accessToken
  }
  if (inFlightAuth) return inFlightAuth

  const creds = cjCredentials()
  if (!creds) {
    throw new Error(
      "CJ_API_EMAIL / CJ_API_KEY manquantes (.env.local) — créez un compte CJ Dropshipping et générez une clé API (Réglages → API)."
    )
  }

  inFlightAuth = (async () => {
    const res = await fetch(`${CJ_API_BASE}/authentication/getAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.apiKey }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => null)) as CjEnvelope<{
      accessToken?: string
      accessTokenExpiryDate?: string
    }> | null
    if (!res.ok || !json?.result || !json.data?.accessToken) {
      throw new Error(`CJ auth failed (${res.status}): ${json?.message ?? "unknown"}`)
    }
    const expiresAt = json.data.accessTokenExpiryDate
      ? new Date(json.data.accessTokenExpiryDate).getTime()
      : Date.now() + 14 * 24 * 60 * 60 * 1000
    cachedToken = { accessToken: json.data.accessToken, expiresAt }
    return json.data.accessToken
  })()

  try {
    return await inFlightAuth
  } finally {
    inFlightAuth = null
  }
}

type CjVariant = {
  vid?: string
  variantSku?: string
  variantNameEn?: string
  variantSellPrice?: number | string
  variantImage?: string
}

type CjProductDetail = {
  pid?: string
  productNameEn?: string
  bigImage?: string
  productImageSet?: string[]
  sellPrice?: number | string
  description?: string
  categoryName?: string
  productWeight?: number | string
  variants?: CjVariant[]
}

export type Cj1688ProductResult = {
  name: string
  description: string
  /** USD — CJ's API is USD-only, convert before storing as a EUR-denominated price. */
  priceUsd: number
  images: string[]
  category: string
  variants: Array<{ name: string; priceUsd: number; sku: string }>
  source: string
}

/** Fetches a CJ product by its detail-page URL via the official product/query endpoint. */
export async function getCjProduct(url: string): Promise<Cj1688ProductResult> {
  const pid = extractCjProductId(url)
  if (!pid) {
    throw new Error("URL CJ Dropshipping invalide — attendu …-p-<id>.html")
  }

  const token = await getCjAccessToken()
  const res = await fetch(`${CJ_API_BASE}/product/query?pid=${encodeURIComponent(pid)}`, {
    method: "GET",
    headers: { "CJ-Access-Token": token },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as CjEnvelope<CjProductDetail> | null
  if (!res.ok || json?.result === false) {
    throw new Error(`CJ product/query failed (${res.status}): ${json?.message ?? "unknown"}`)
  }
  const data = json?.data
  if (!data) {
    throw new Error("CJ: réponse sans donnée produit")
  }

  const toNumber = (v: unknown, fallback = 0) => {
    const n = Number.parseFloat(String(v ?? ""))
    return Number.isFinite(n) ? n : fallback
  }

  const images = [
    ...(data.bigImage ? [data.bigImage] : []),
    ...(Array.isArray(data.productImageSet) ? data.productImageSet : []),
  ]

  return {
    name: String(data.productNameEn ?? "").trim(),
    description: String(data.description ?? "").trim(),
    priceUsd: toNumber(data.sellPrice),
    images: [...new Set(images)].filter(Boolean),
    category: String(data.categoryName ?? "").trim(),
    variants: (Array.isArray(data.variants) ? data.variants : []).map((v) => ({
      name: String(v.variantNameEn ?? "").trim() || "Default",
      priceUsd: toNumber(v.variantSellPrice, toNumber(data.sellPrice)),
      sku: String(v.variantSku ?? v.vid ?? "").trim(),
    })),
    source: `https://cjdropshipping.com/product/detail-p-${pid}.html`,
  }
}
