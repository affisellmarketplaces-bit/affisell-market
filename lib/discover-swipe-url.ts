/** Buyer Affisell Pulse — swipe commerce entry URLs. */
export function discoverSwipeHref(params?: {
  category?: string | null
  subcategory?: string | null
  layout?: "swipe" | "scroll"
}): string {
  const sp = new URLSearchParams()
  const category = params?.category?.trim()
  const subcategory = params?.subcategory?.trim()
  if (category) sp.set("category", category)
  if (subcategory) sp.set("subcategory", subcategory)
  if (params?.layout === "scroll") sp.set("layout", "scroll")
  const qs = sp.toString()
  return qs ? `/discover?${qs}` : "/discover"
}
