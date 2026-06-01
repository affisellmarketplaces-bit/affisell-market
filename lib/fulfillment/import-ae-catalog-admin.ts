import { getAliExpressConfigStatus } from "@/lib/aliexpress-config"
import { parseAeCatalogFromHtml } from "@/lib/fulfillment/ae-catalog-from-html"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import { parsePastedAerJson } from "@/lib/fulfillment/parse-pasted-aer-json"
import {
  resolveSupplierLinkFromAeInput,
  resolveSupplierLinkFromAerPaste,
  type ResolvedSupplierLinkFields,
} from "@/lib/fulfillment/supplier-link-resolve"
import { suggestVariantMappings } from "@/lib/fulfillment/resolve-supplier-sku"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { getScrapingBeeApiKey } from "@/lib/import-url-scrape"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"

export type AeCatalogImportPayload = {
  resolved: ResolvedSupplierLinkFields & { aeSkus: AeProductSkuRow[] }
  suggestions: ReturnType<typeof suggestVariantMappings>
  source: "api" | "page" | "paste" | "html"
}

export type AeCatalogImportDiagnostics = {
  apiConfigured: boolean
  scrapingBeeConfigured: boolean
}

export function getAeCatalogImportDiagnostics(): AeCatalogImportDiagnostics {
  return {
    apiConfigured: getAliExpressConfigStatus().configured,
    scrapingBeeConfigured: Boolean(getScrapingBeeApiKey()),
  }
}

function buildPayload(
  resolved: ResolvedSupplierLinkFields,
  productVariants: { id: string; color: string | null; size: string | null }[],
  source: AeCatalogImportPayload["source"]
): AeCatalogImportPayload {
  const aeSkus = resolved.aeSkus ?? []
  if (aeSkus.length === 0) {
    throw new AliExpressApiError(
      "Aucun SKU AE numérique trouvé dans cette source — essayez l’import par fichier HTML."
    )
  }
  return {
    resolved: { ...resolved, aeSkus },
    suggestions: suggestVariantMappings(productVariants, aeSkus),
    source,
  }
}

export async function importAeCatalogForAdmin(
  aeUrlInput: string,
  productVariants: { id: string; color: string | null; size: string | null }[],
  opts?: { html?: string; aerData?: unknown; aerJson?: string }
): Promise<AeCatalogImportPayload> {
  const aeProductId = parseAliExpressProductId(aeUrlInput)
  if (!aeProductId) {
    throw new AliExpressApiError("URL ou ID produit AliExpress invalide")
  }

  const aeUrl =
    aeUrlInput.trim().includes("aliexpress")
      ? aeUrlInput.trim()
      : `https://www.aliexpress.com/item/${aeProductId}.html`

  if (opts?.aerJson?.trim()) {
    const aerData = parsePastedAerJson(opts.aerJson)
    const resolved = resolveSupplierLinkFromAerPaste(aeProductId, aerData, aeUrl)
    return buildPayload(resolved, productVariants, "paste")
  }

  if (opts?.aerData !== undefined && opts.aerData !== null) {
    const resolved = resolveSupplierLinkFromAerPaste(aeProductId, opts.aerData, aeUrl)
    return buildPayload(resolved, productVariants, "paste")
  }

  if (opts?.html && opts.html.length > 80) {
    const parsed = parseAeCatalogFromHtml(opts.html, aeUrl)
    const firstSku = parsed.aeSkus.find((s) => s.aeSkuId) ?? parsed.aeSkus[0]
    const resolved: ResolvedSupplierLinkFields = {
      aeProductId,
      aeSkuId: firstSku?.aeSkuId ?? null,
      aeShopId: parsed.aeShopId,
      aePriceCents: firstSku?.aePriceCents ?? parsed.aePriceCents,
      aeShippingCents: 0,
      aeUrl,
      aeSkus: parsed.aeSkus,
      source: "html",
    }
    return buildPayload(resolved, productVariants, "html")
  }

  const resolved = await resolveSupplierLinkFromAeInput(aeUrl)
  const source = resolved.source === "api" ? "api" : "page"
  return buildPayload(resolved, productVariants, source)
}
