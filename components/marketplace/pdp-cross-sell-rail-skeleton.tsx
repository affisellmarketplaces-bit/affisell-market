import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"

export function PdpCrossSellRailSkeleton() {
  return (
    <div className="mt-10 space-y-4" aria-hidden>
      <ShimmerSkeleton className="h-6 w-48 rounded-lg" />
      <ul className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <ShimmerSkeleton className="aspect-square w-full rounded-xl" />
            <ShimmerSkeleton className="mt-2 h-3 w-[80%] rounded-md" />
            <ShimmerSkeleton className="mt-1.5 h-4 w-14 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  )
}
