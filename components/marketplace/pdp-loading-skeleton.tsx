import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/** Instant PDP shell — shown on client navigation while the RSC payload streams. */
export function PdpLoadingSkeleton({ className }: Props) {
  return (
    <div
      className={cn(
        "affisell-pdp-loading mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8",
        className
      )}
      aria-busy="true"
      aria-label="Loading product"
    >
      <ShimmerSkeleton className="mb-4 h-3 w-40 rounded-md" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
        <div className="space-y-3">
          <ShimmerSkeleton className="aspect-[4/5] w-full rounded-2xl sm:rounded-3xl" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <ShimmerSkeleton className="h-4 w-24 rounded-full" />
          <ShimmerSkeleton className="h-8 w-[92%] rounded-xl" />
          <ShimmerSkeleton className="h-8 w-[70%] rounded-xl" />
          <ShimmerSkeleton className="h-10 w-36 rounded-xl" />
          <ShimmerSkeleton className="h-12 w-full rounded-2xl" />
          <ShimmerSkeleton className="h-12 w-full rounded-2xl" />
          <div className="space-y-2 pt-2">
            <ShimmerSkeleton className="h-4 w-full rounded-md" />
            <ShimmerSkeleton className="h-4 w-[88%] rounded-md" />
            <ShimmerSkeleton className="h-4 w-[76%] rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
