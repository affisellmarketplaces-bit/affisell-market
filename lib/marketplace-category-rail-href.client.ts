import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { catalogFilterHrefFromParams } from "@/lib/marketplace-catalog-nav.client"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"

/** In-app catalog shells — soft ?category= nav (no full /browse/{slug} document). */
export function isSoftCategoryCatalogBase(catalogBasePath: string): boolean {
  const base = catalogBasePath.replace(/\/$/, "") || "/"
  return base === "/" || base === PUBLIC_MARKETPLACE_BROWSE_PATH || base === "/shops/browse"
}

type CategoryRailTarget = {
  id: string
  slug: string
}

/** Department / rayons pill href — instant filter on home embed, SEO path elsewhere. */
export function categoryRailHref(catalogBasePath: string, category: CategoryRailTarget): string {
  if (isSoftCategoryCatalogBase(catalogBasePath)) {
    return catalogFilterHrefFromParams(
      catalogBasePath,
      new URLSearchParams({ category: category.id })
    )
  }
  return categoryBrowsePath(category.slug)
}

/** Browse departments API row — prefers categoryId on in-app catalog bases. */
export function browseDepartmentRailHref(
  catalogBasePath: string,
  dept: {
    categoryId: string | null
    categorySlug: string | null
    searchQuery?: string | null
  }
): string {
  if (dept.categoryId && isSoftCategoryCatalogBase(catalogBasePath)) {
    return catalogFilterHrefFromParams(
      catalogBasePath,
      new URLSearchParams({ category: dept.categoryId })
    )
  }
  if (dept.categorySlug) return categoryBrowsePath(dept.categorySlug)
  const sp = new URLSearchParams()
  if (dept.searchQuery?.trim()) sp.set("q", dept.searchQuery.trim())
  return catalogFilterHrefFromParams(catalogBasePath, sp)
}
