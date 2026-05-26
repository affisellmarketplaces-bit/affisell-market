import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"

export function BentoGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <ShimmerSkeleton key={i} className="h-36 rounded-2xl" />
      ))}
    </div>
  )
}
