/** Build catalog browse URL with optional category filters (home embed adds #explorer). */
export function marketplaceCatalogHref(
  catalogBasePath: string,
  params?: { category?: string; subcategory?: string }
): string {
  const sp = new URLSearchParams()
  if (params?.category) sp.set("category", params.category)
  if (params?.subcategory) sp.set("subcategory", params.subcategory)
  const qs = sp.toString()
  const path = catalogBasePath.replace(/\/$/, "") || "/"
  const url = qs ? `${path}?${qs}` : path
  return path === "/" ? `${url}#explorer` : url
}
