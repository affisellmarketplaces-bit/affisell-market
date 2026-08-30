/** Marketplace path segments that are hubs, not listing PDP ids. */
export const MARKETPLACE_RESERVED_SEGMENTS = new Set([
  "account",
  "import",
  "bestsellers",
])

export function isMarketplaceReservedSegment(segment: string): boolean {
  return MARKETPLACE_RESERVED_SEGMENTS.has(segment.trim().toLowerCase())
}

export function marketplaceFirstSegment(pathname: string): string | null {
  if (!pathname.startsWith("/marketplace/")) return null
  const rest = pathname.slice("/marketplace/".length)
  const segment = rest.split("/").filter(Boolean)[0]
  return segment ?? null
}

export function isMarketplaceHubPath(pathname: string): boolean {
  const segment = marketplaceFirstSegment(pathname)
  return segment != null && isMarketplaceReservedSegment(segment)
}
