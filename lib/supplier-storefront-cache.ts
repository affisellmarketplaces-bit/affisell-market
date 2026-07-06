import { unstable_cache } from "next/cache"

import {
  loadSupplierShopCatalog,
  loadSupplierShopStore,
  type SupplierCatalogProduct,
  type SupplierShopStore,
} from "@/lib/supplier-storefront-data"
import { loadSupplierStorefrontCatalogProduct } from "@/lib/supplier-storefront-product-preview"

const SUPPLIER_REVALIDATE_SEC = 60

/** Use literal `export const revalidate = 60` in app routes — Next.js rejects imported segment config. */

function supplierTag(slug: string): string {
  return `supplier-${slug.trim().toLowerCase()}`
}

export function loadSupplierShopStoreCached(slug: string): Promise<SupplierShopStore | null> {
  const key = slug.trim().toLowerCase()
  return unstable_cache(() => loadSupplierShopStore(key), ["supplier-shop-store", key], {
    revalidate: SUPPLIER_REVALIDATE_SEC,
    tags: [supplierTag(key)],
  })()
}

export function loadSupplierShopCatalogCached(
  supplierUserId: string,
  slug: string
): Promise<{
  products: SupplierCatalogProduct[]
  partnerListingCountByProductId: Record<string, number>
}> {
  const key = slug.trim().toLowerCase()
  const userId = supplierUserId.trim()
  return unstable_cache(
    () => loadSupplierShopCatalog(userId),
    ["supplier-shop-catalog", key, userId],
    { revalidate: SUPPLIER_REVALIDATE_SEC, tags: [supplierTag(key)] }
  )()
}

export function loadSupplierStorefrontCatalogProductCached(storeSlug: string, productId: string) {
  const slug = storeSlug.trim().toLowerCase()
  const pid = productId.trim()
  return unstable_cache(
    () => loadSupplierStorefrontCatalogProduct({ storeSlug: slug, productId: pid }),
    ["supplier-shop-product", slug, pid],
    { revalidate: SUPPLIER_REVALIDATE_SEC, tags: [supplierTag(slug)] }
  )()
}

export { SUPPLIER_REVALIDATE_SEC, supplierTag }
