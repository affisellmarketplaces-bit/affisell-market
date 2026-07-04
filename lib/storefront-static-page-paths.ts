import type { StorefrontStaticPageKind } from "@/lib/storefront-static-pages-shared"

/** Public path for a store static page (works on `/shops/{slug}` and custom domain `/`). */
export function shopStaticPagePath(
  shopHomePath: string,
  kind: StorefrontStaticPageKind
): string {
  const base = shopHomePath.replace(/\/$/, "") || ""
  return `${base}/${kind}`
}
