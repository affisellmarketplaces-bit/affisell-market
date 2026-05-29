/** Build catalog browse URL with optional category filters (home embed adds #explorer). */
export function marketplaceCatalogHref(
  catalogBasePath: string,
  params?: { category?: string; subcategory?: string } | URLSearchParams
): string {
  const sp =
    params instanceof URLSearchParams
      ? new URLSearchParams(params.toString())
      : (() => {
          const next = new URLSearchParams()
          if (params?.category) next.set("category", params.category)
          if (params?.subcategory) next.set("subcategory", params.subcategory)
          return next
        })()
  const qs = sp.toString()
  const path = catalogBasePath.replace(/\/$/, "") || "/"
  const url = qs ? `${path}?${qs}` : path
  return path === "/" ? `${url}#explorer` : url
}
