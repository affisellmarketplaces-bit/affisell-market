/** Marketplace PDP review deep link after checkout (Affisell pattern). */
export function buildSuccessReviewHref(
  affiliateProductId: string,
  orderId: string
): string {
  const params = new URLSearchParams({ writeReview: "true", orderId })
  return `/marketplace/${encodeURIComponent(affiliateProductId)}?${params.toString()}`
}
