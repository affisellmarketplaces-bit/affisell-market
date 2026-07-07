/** Lightweight placeholder while deferred sheet panels mount. */
export function MobileSheetBodySkeleton() {
  return (
    <div className="space-y-3 px-1 py-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-white/8" />
      ))}
    </div>
  )
}
