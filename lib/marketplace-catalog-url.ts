/** Build catalog browse URL with optional category filters (home embed adds #explorer). */
export function marketplaceCatalogHref(
  catalogBasePath: string,
  params?: {
    category?: string
    subcategory?: string
    q?: string
    shipsTo?: string
  } | URLSearchParams
): string {
  const sp =
    params instanceof URLSearchParams
      ? new URLSearchParams(params.toString())
      : (() => {
          const next = new URLSearchParams()
          if (params?.category) next.set("category", params.category)
          if (params?.subcategory) next.set("subcategory", params.subcategory)
          if (params?.q) next.set("q", params.q)
          if (params?.shipsTo) next.set("shipsTo", params.shipsTo.toLowerCase())
          return next
        })()
  const qs = sp.toString()
  const path = catalogBasePath.replace(/\/$/, "") || "/"
  const url = qs ? `${path}?${qs}` : path
  return path === "/" ? `${url}#explorer` : url
}
