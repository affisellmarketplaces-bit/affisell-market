import { MARKETPLACE_QUERY_RESERVED } from "@/lib/marketplace-query-params"

/** Query params for selecting a taxonomy node in the buyer catalog. */
export function marketplaceCategorySearchParams(
  current: URLSearchParams,
  nodeId: string
): URLSearchParams {
  const params = new URLSearchParams(current.toString())
  for (const key of [...params.keys()]) {
    if (!MARKETPLACE_QUERY_RESERVED.has(key)) params.delete(key)
  }
  params.delete("category")
  params.delete("subcategory")
  params.delete("categoryId")
  params.delete("subcategoryId")
  params.delete("dept")
  params.set("category", nodeId.trim())
  return params
}
