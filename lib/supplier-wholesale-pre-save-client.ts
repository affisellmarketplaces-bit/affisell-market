export type SupplierWholesalePreview = {
  hasIncrease: boolean
  affiliateListingsLive: number
  listingsAtRisk: number
  atLossCount: number
  increaseCount: number
  skipped?: boolean
}

export async function fetchSupplierWholesalePreview(
  productId: string,
  draftBody: Record<string, unknown>
): Promise<SupplierWholesalePreview | null> {
  try {
    const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}/wholesale-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(draftBody),
    })
    const data = (await res.json()) as SupplierWholesalePreview & { error?: string }
    if (!res.ok) return null
    return data
  } catch {
    return null
  }
}

export function wholesalePreSaveNeedsConfirm(preview: SupplierWholesalePreview | null): boolean {
  if (!preview || preview.skipped) return false
  return preview.hasIncrease && preview.affiliateListingsLive > 0
}
