import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"

/** Pill-row shaped block — matches DepartmentBar / PopularDepartmentsBar's rough footprint. */
function PillRowSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl bg-white p-3 shadow-sm" aria-hidden>
      <ShimmerSkeleton className="h-3.5 w-32 rounded-md" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * Outer Suspense fallback for the home's category/discover/catalog section —
 * mirrors the real stacked layout (pill row, 2x2 discover grid, pill row,
 * dark banner) instead of one flat rectangle, so slow data fetches don't
 * collapse from a short skeleton into much taller real content (CLS).
 */
export function BuyerPremiumMarketplaceSkeleton() {
  return (
    <div className="space-y-5 p-3 sm:p-5" aria-hidden>
      <PillRowSkeleton />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <ShimmerSkeleton className="h-5 w-36 rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              <ShimmerSkeleton className="aspect-square rounded-xl" />
              <ShimmerSkeleton className="aspect-square rounded-xl" />
              <ShimmerSkeleton className="aspect-square rounded-xl" />
            </div>
            <ShimmerSkeleton className="h-3 w-2/3 rounded-md" />
          </div>
        ))}
      </div>
      <PillRowSkeleton />
      <ShimmerSkeleton className="h-16 w-full rounded-2xl" />
    </div>
  )
}
