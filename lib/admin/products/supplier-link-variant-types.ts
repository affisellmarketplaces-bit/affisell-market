export type AdminVariantMappingInput = {
  id?: string
  productVariantId?: string | null
  matchColor?: string | null
  matchSize?: string | null
  aeSkuId: string
  aePriceCents: number
  aeShippingCents?: number
  aeLabel?: string | null
}

export type AdminVariantMappingRow = {
  id: string
  productVariantId: string | null
  matchColor: string | null
  matchSize: string | null
  aeSkuId: string
  aePriceCents: number
  aeShippingCents: number
  aeLabel: string | null
  productVariant?: {
    id: string
    color: string | null
    size: string | null
    sku: string | null
  } | null
}
