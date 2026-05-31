import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import { parseAeSkusFromPagePayload } from "@/lib/fulfillment/ae-page-skus"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"

export type AeCaptureResolvedFields = {
  aeProductId: string
  aeSkuId: string | null
  aeShopId: string
  aePriceCents: number
  aeShippingCents: number
  aeUrl: string
  aeSkus: AeProductSkuRow[]
  source: "paste"
}

export function resolvedFieldsFromAerPaste(
  aeUrl: string,
  aerPayload: unknown
): AeCaptureResolvedFields | null {
  const aeProductId = parseAliExpressProductId(aeUrl)
  if (!aeProductId) return null

  const parsed = parseAeSkusFromPagePayload(aerPayload)
  const firstSku = parsed.aeSkus.find((s) => s.aeSkuId) ?? parsed.aeSkus[0]

  return {
    aeProductId,
    aeSkuId: firstSku?.aeSkuId ?? null,
    aeShopId: parsed.aeShopId,
    aePriceCents: firstSku?.aePriceCents ?? parsed.aePriceCents,
    aeShippingCents: 0,
    aeUrl: aeUrl.trim(),
    aeSkus: parsed.aeSkus,
    source: "paste",
  }
}
