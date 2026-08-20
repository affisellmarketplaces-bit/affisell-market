import { HomeCatalogSkeleton } from "@/components/home/home-catalog-skeleton"

/** Instant shell while browse catalog SSR streams in. */
export default function ShopsBrowseLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <HomeCatalogSkeleton count={12} />
    </div>
  )
}
