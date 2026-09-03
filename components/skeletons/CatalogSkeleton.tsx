import { HomeCatalogSkeleton } from "@/components/home/home-catalog-skeleton"

/** Home catalog shimmer — 8 pulsing cards for instant-nav Suspense fallback. */
export function CatalogSkeleton() {
  return <HomeCatalogSkeleton count={8} />
}
