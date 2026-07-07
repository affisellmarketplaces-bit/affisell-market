import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Match live grid: 8 cards on home, 6 on narrow loading states. */
  count?: number
}

/** Shared home / embedded catalog shimmer — aspect-square matches `ProductCard`. */
export function HomeCatalogSkeleton({ className, count = 8 }: Props) {
  return (
    <div
      className={cn(
        "affisell-home-catalog-skeleton space-y-2.5 rounded-2xl border border-dashed border-violet-200/40 bg-gradient-to-b from-violet-50/30 to-white/80 p-2.5 dark:border-violet-900/30 dark:from-violet-950/20 dark:to-zinc-950/40 sm:space-y-4 sm:rounded-3xl sm:p-6",
        className
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <ShimmerSkeleton className="h-6 w-28 rounded-xl sm:h-8 sm:w-48" />
        <ShimmerSkeleton className="ml-auto hidden h-6 w-20 rounded-full sm:block" />
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="space-y-1.5">
            <ShimmerSkeleton className="aspect-square w-full rounded-2xl sm:rounded-3xl" />
            <ShimmerSkeleton className="h-3 w-[88%] rounded-md" />
            <ShimmerSkeleton className="h-3.5 w-16 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  )
}
