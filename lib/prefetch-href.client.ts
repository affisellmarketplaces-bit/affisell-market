/** Normalize internal hrefs for Next.js `router.prefetch` (strip hash/query). */
export function normalizePrefetchHref(href: string | null | undefined): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null
  let path = href.split("#")[0]?.split("?")[0] ?? ""
  if (!path) path = "/"
  if (path.includes("[") || path.includes("]")) return null
  return path
}

export function isSameOriginNavigableAnchor(anchor: HTMLAnchorElement): boolean {
  if (anchor.target === "_blank") return false
  if (anchor.hasAttribute("download")) return false
  if (anchor.getAttribute("rel")?.includes("external")) return false
  const href = anchor.getAttribute("href")
  if (!href) return false
  if (
    href.startsWith("http") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return false
  }
  return href.startsWith("/")
}
