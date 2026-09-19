/**
 * The home page ships a server-rendered product list (`initialBrowse`) and, when it is present, the client does
 * not refetch on mount. If the server load failed (cold database, timeout) the shell is EMPTY — trusting it
 * would freeze the page on "Catalog is empty" until the next reload. An empty initial list must be re-checked.
 */
export function shouldRevalidateCatalogOnMount(args: { useInitialFallback: boolean; initialProductCount: number }): boolean {
  return !args.useInitialFallback || args.initialProductCount === 0
}

/** Show the skeleton (not the "empty" message) while an empty server list is being re-checked. */
export function isCatalogLoading(args: {
  productCount: number
  isLoading: boolean
  isValidating: boolean
  initialListWasEmpty: boolean
}): boolean {
  return args.productCount === 0 && (args.isLoading || (args.initialListWasEmpty && args.isValidating))
}
