import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"

/** Instant shell while the bestsellers hub RSC payload streams. */
export function BestsellersHubLoadingSkeleton() {
  return (
    <div
      className="relative min-h-[calc(100dvh-3.75rem)] overflow-x-clip bg-[#07060f] px-4 py-6 sm:px-6 sm:py-10"
      aria-busy="true"
      aria-label="Loading bestsellers"
    >
      <ShimmerSkeleton className="h-8 w-28 rounded-full bg-white/10" />
      <div className="mx-auto mt-10 max-w-2xl space-y-4 text-center">
        <ShimmerSkeleton className="mx-auto h-12 w-12 rounded-2xl bg-white/10" />
        <ShimmerSkeleton className="mx-auto h-10 w-3/4 max-w-md rounded-xl bg-white/10" />
        <ShimmerSkeleton className="mx-auto h-5 w-full max-w-lg rounded-lg bg-white/10" />
      </div>
      <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className={i === 0 ? "md:col-span-2 md:row-span-2" : undefined}>
            <ShimmerSkeleton
              className={`w-full rounded-[1.35rem] bg-white/10 ${i === 0 ? "aspect-[4/3] md:aspect-square" : "aspect-square"}`}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
