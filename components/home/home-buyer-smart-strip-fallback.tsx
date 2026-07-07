/** Placeholder while buyer smart strip streams — preserves layout, no CLS. */
export function HomeBuyerSmartStripFallback() {
  return (
    <div
      className="relative mt-6 border-t border-white/20 pt-6 sm:mt-10 sm:pt-8 lg:mt-12 lg:pt-10"
      aria-hidden
    >
      <div className="mx-auto h-3 w-32 rounded-full bg-white/10" />
      <div className="mt-4 flex gap-2.5 overflow-hidden px-0.5 md:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[7.5rem] w-[42%] shrink-0 rounded-2xl bg-white/8" />
        ))}
      </div>
      <div className="mt-4 hidden gap-3 md:grid md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/8" />
        ))}
      </div>
    </div>
  )
}
