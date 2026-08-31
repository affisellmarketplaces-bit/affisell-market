import { isMarketplaceHubPath } from "@/lib/marketplace-reserved-segments"

const LOCALE_PREFIX = /^\/(en|fr)(?=\/|$)/

/** Strip `/fr` or `/en` prefix for path checks. */
export function bareBuyerPathname(pathname: string): string {
  const trimmed = pathname.trim() || "/"
  return trimmed.replace(LOCALE_PREFIX, "") || "/"
}

/**
 * Routes where soft client navigation must reset scroll — otherwise the viewport
 * stays at the previous page offset (often mid-footer on long catalog hubs).
 */
export function shouldResetBuyerScroll(pathname: string): boolean {
  const bare = bareBuyerPathname(pathname.split("?")[0] ?? "")

  if (bare.startsWith("/browse/")) return true
  if (bare === "/marketplace/bestsellers") return true

  const marketplacePdp = bare.match(/^\/marketplace\/([^/]+)$/)
  if (marketplacePdp && !isMarketplaceHubPath(bare)) return true

  return false
}

/** Pre-scroll only when already on a long catalog/PDP surface — never from home `/`. */
export function shouldPreScrollOnInstantNavStart(fromPathname: string, toPathname: string): boolean {
  return shouldResetBuyerScroll(fromPathname) && shouldResetBuyerScroll(toPathname)
}
