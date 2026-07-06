/** Lightweight shell while Pulse client bundles load. */
export function DiscoverPulseLoading() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 text-zinc-400"
      data-testid="discover-pulse-loading"
      aria-busy="true"
      aria-label="Loading Pulse"
    >
      <div className="size-10 animate-pulse rounded-full bg-violet-500/30" />
      <p className="mt-4 text-sm font-medium tracking-wide text-zinc-500">Pulse</p>
    </div>
  )
}
