/** Buyer Affisell Pulse — swipe commerce entry URLs. */
export function discoverSwipeHref(params?: {
  category?: string | null
  subcategory?: string | null
  layout?: "swipe" | "scroll"
  coach?: boolean
}): string {
  const sp = new URLSearchParams()
  const category = params?.category?.trim()
  const subcategory = params?.subcategory?.trim()
  if (category) sp.set("category", category)
  if (subcategory) sp.set("subcategory", subcategory)
  if (params?.layout === "scroll") sp.set("layout", "scroll")
  if (params?.coach) sp.set("coach", "1")
  const qs = sp.toString()
  return qs ? `/discover?${qs}` : "/discover"
}
