import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { parseAeCatalogFromHtml } from "@/lib/fulfillment/ae-catalog-from-html"
import { parseAeSkusFromPagePayload } from "@/lib/fulfillment/ae-page-skus"
import { fetchAliExpressProductHtml } from "@/lib/fulfillment/fetch-ae-page-html"
import { parseAeProductSkusFromPayload } from "@/lib/fulfillment/ae-product-skus"
import {
  AliExpressApiError,
  AliExpressClient,
  createAliExpressClient,
  unwrapAliExpressMethodResponse,
} from "@/lib/aliexpress-open-api"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"

export type ResolvedSupplierLinkFields = {
  aeProductId: string
  aeSkuId: string | null
  aeShopId: string
  aePriceCents: number
  aeShippingCents: number
  aeUrl: string
  aeSkus?: import("@/lib/fulfillment/ae-product-skus").AeProductSkuRow[]
  /** api = Open Platform, page = scrape __AER_DATA__, paste = JSON collé */
  source?: "api" | "page" | "paste"
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return ""
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function normalizeAeUrl(productId: string, input?: string): string {
  const trimmed = input?.trim()
  if (trimmed && trimmed.includes("aliexpress")) return trimmed
  return `https://www.aliexpress.com/item/${productId}.html`
}

function parseShopId(payload: unknown): string {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}
  const store =
    asRecord(result.ae_store_info) ??
    asRecord(result.store_info) ??
    asRecord(result.ae_store_info_dto) ??
    {}
  return (
    pickString(store, ["store_id", "storeId", "shop_id", "shopId"]) ||
    pickString(result, ["store_id", "storeId", "shop_id", "shopId", "seller_id", "sellerId"])
  )
}

function parseFirstSkuId(payload: unknown): string | null {
  const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
  const result = asRecord(methodNode?.result) ?? methodNode ?? {}
  const raw =
    result.ae_item_sku_info_dtos ??
    result.ae_item_sku_info_dto ??
    result.sku_info ??
    result.skus
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  for (const item of list) {
    const sku = asRecord(item)
    const id =
      pickString(sku, ["sku_id", "skuId", "ae_sku_id", "id"]) ||
      (sku?.sku_id != null ? String(sku.sku_id) : "")
    if (id) return id
  }
  return null
}

/** Resolve from pasted __AER_DATA__ JSON (no network). */
export function resolveSupplierLinkFromAerPaste(
  aeProductId: string,
  aerPayload: unknown,
  aeUrl?: string
): ResolvedSupplierLinkFields {
  const parsed = parseAeSkusFromPagePayload(aerPayload)
  const firstSku = parsed.aeSkus.find((s) => s.aeSkuId) ?? parsed.aeSkus[0]

  return {
    aeProductId,
    aeSkuId: firstSku?.aeSkuId ?? null,
    aeShopId: parsed.aeShopId,
    aePriceCents: firstSku?.aePriceCents ?? parsed.aePriceCents,
    aeShippingCents: 0,
    aeUrl: normalizeAeUrl(aeProductId, aeUrl),
    aeSkus: parsed.aeSkus,
    source: "paste",
  }
}

/** Scrape product page HTML when Open API is unavailable. */
function aeFetchUrlCandidates(aeProductId: string, aeUrl: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (u: string) => {
    const t = u.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  add(normalizeAeUrl(aeProductId, aeUrl))
  add(`https://www.aliexpress.com/item/${aeProductId}.html`)
  add(`https://fr.aliexpress.com/item/${aeProductId}.html`)
  return out
}

export async function resolveSupplierLinkFromAePage(
  aeProductId: string,
  aeUrl: string
): Promise<ResolvedSupplierLinkFields> {
  const candidates = aeFetchUrlCandidates(aeProductId, aeUrl)
  let lastError = "Page AE inaccessible."

  for (const url of candidates) {
    const fetched = await fetchAliExpressProductHtml(url)
    if (!fetched.ok) {
      lastError = fetched.error
      continue
    }

    const parsed = parseAeCatalogFromHtml(fetched.html, url)
    if (parsed.aeSkus.length === 0) {
      lastError =
        "Catalogue JSON introuvable dans la page — AliExpress bloque souvent le serveur. Utilisez Import Express."
      continue
    }

    const firstSku = parsed.aeSkus.find((s) => s.aeSkuId) ?? parsed.aeSkus[0]
    console.log("[supplier-link-resolve]", {
      aeProductId,
      source: "page",
      fetchUrl: url,
      skuCount: parsed.aeSkus.length,
      aeShopId: parsed.aeShopId,
    })

    return {
      aeProductId,
      aeSkuId: firstSku?.aeSkuId ?? null,
      aeShopId: parsed.aeShopId,
      aePriceCents: firstSku?.aePriceCents ?? parsed.aePriceCents,
      aeShippingCents: 0,
      aeUrl: normalizeAeUrl(aeProductId, aeUrl),
      aeSkus: parsed.aeSkus,
      source: "page",
    }
  }

  throw new AliExpressApiError(
    `${lastError} Configurez SCRAPINGBEE_API_KEY ou utilisez Import Express (favori navigateur).`
  )
}

/** Resolve AliExpress URL or product id → supplier link fields (Open API when configured). */
export async function resolveSupplierLinkFromAeInput(
  input: string,
  opts?: { aerDataPaste?: unknown }
): Promise<ResolvedSupplierLinkFields> {
  const aeProductId = parseAliExpressProductId(input)
  if (!aeProductId) {
    throw new AliExpressApiError("Invalid AliExpress URL or product id")
  }

  const aeUrl = normalizeAeUrl(aeProductId, input)

  if (opts?.aerDataPaste !== undefined) {
    return resolveSupplierLinkFromAerPaste(aeProductId, opts.aerDataPaste, aeUrl)
  }

  if (!AliExpressClient.isConfigured()) {
    return await resolveSupplierLinkFromAePage(aeProductId, aeUrl)
  }

  try {
    const client = await createAliExpressClient()
    const raw = await client.getProduct(aeProductId)
    const mapped = mapAliExpressGetProductResponse(raw, aeProductId)
    const aeSkus = parseAeProductSkusFromPayload(raw, aeProductId).filter((s) => s.aeSkuId)
    if (aeSkus.length === 0) {
      console.log("[supplier-link-resolve]", { aeProductId, apiEmpty: true, fallback: "page" })
      return await resolveSupplierLinkFromAePage(aeProductId, aeUrl)
    }
    const firstSku = aeSkus[0]

    return {
      aeProductId,
      aeSkuId: firstSku?.aeSkuId || parseFirstSkuId(raw),
      aeShopId: parseShopId(raw),
      aePriceCents: firstSku?.aePriceCents ?? mapped.basePriceCents,
      aeShippingCents: 0,
      aeUrl,
      aeSkus,
      source: "api",
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log("[supplier-link-resolve]", { aeProductId, apiError: msg, fallback: "page" })
    return await resolveSupplierLinkFromAePage(aeProductId, aeUrl)
  }
}
