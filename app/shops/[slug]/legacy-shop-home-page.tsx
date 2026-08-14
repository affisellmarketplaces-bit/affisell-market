import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { StorefrontHomeSections } from "@/components/storefront/storefront-home-sections"
import {
  filterShopProductsByCategory,
  groupShopProductsByCategory,
} from "@/lib/shop-storefront-categories"
import type { e2eFlashSaleShopFixture } from "@/lib/e2e-storefront-flash-sale-fixtures"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"

type Fixture = ReturnType<typeof e2eFlashSaleShopFixture>

type Props = {
  slug: string
  searchParams: { cat?: string }
  fixture: Fixture
}

/** E2E-only legacy storefront — production buyers redirect to /boutique in page.tsx. */
export default async function LegacyShopSlugPage({ slug, searchParams, fixture }: Props) {
  const { cat } = searchParams
  const hdrs = await headers()
  const isDedicatedHost = isCustomDomainHeaders(hdrs)

  const storeFront = fixture.store
  const trust = null
  const products = fixture.products
  if (!storeFront) notFound()

  const categories = groupShopProductsByCategory(products)
  const activeCategory =
    typeof cat === "string" && cat.length > 0
      ? categories.find((c) => c.slug === cat) ?? null
      : null
  const visibleProducts = filterShopProductsByCategory(products, activeCategory?.id ?? null)

  return (
    <StorefrontHomeSections
      store={storeFront}
      trust={trust}
      slug={slug}
      products={visibleProducts}
      catalogProducts={products}
      activeCategoryLabel={activeCategory?.name ?? null}
      isDedicatedHost={isDedicatedHost}
    />
  )
}
