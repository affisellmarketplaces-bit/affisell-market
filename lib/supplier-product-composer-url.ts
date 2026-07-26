/** Composer URLs for supplier listing editor (not the video page under `/products/[id]`). */

export function supplierProductComposerEditPath(
  productId: string,
  opts?: { isDraft?: boolean }
): string {
  const id = productId.trim()
  if (!id) return "/dashboard/supplier/products/new"
  if (opts?.isDraft) {
    return `/dashboard/supplier/products/new?compose=1&draft=${encodeURIComponent(id)}`
  }
  return `/dashboard/supplier/products/new?edit=${encodeURIComponent(id)}`
}

export function supplierProductComposerEditAbsoluteUrl(
  productId: string,
  siteBase: string,
  opts?: { isDraft?: boolean }
): string {
  const base = siteBase.replace(/\/$/, "")
  return `${base}${supplierProductComposerEditPath(productId, opts)}`
}
