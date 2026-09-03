export type SupplierWholesalePreview = {
  hasIncrease: boolean
  blocked?: boolean
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

/** Price Shield — wholesale increase blocked while partners list live. */
export function wholesalePreSaveIsBlocked(preview: SupplierWholesalePreview | null): boolean {
  if (!preview || preview.skipped) return false
  if (preview.blocked === true) return true
  return preview.hasIncrease && preview.affiliateListingsLive > 0
}

/** @deprecated use wholesalePreSaveIsBlocked */
export function wholesalePreSaveNeedsConfirm(preview: SupplierWholesalePreview | null): boolean {
  return wholesalePreSaveIsBlocked(preview)
}
