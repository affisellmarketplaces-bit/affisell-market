import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Compact World Radar teaser for mobile catalog — inserted after the first 4 products
 * so it lands ~800px doc top instead of ~5556px.
 */
export function HomeWorldRadarInline({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-500/30 bg-[#050507] px-3.5 py-3 text-white",
        className
      )}
      aria-label="World Radar"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300/90">
        World Radar
      </p>
      <p className="mt-1 text-[13px] font-semibold leading-snug tracking-tight">
        30 marchés · signaux e-commerce · un terminal
      </p>
      <Link
        href="/radar"
        className="mt-2 inline-flex min-h-9 items-center rounded-full bg-violet-600 px-3 text-[11px] font-bold text-white"
      >
        Ouvrir World Radar →
      </Link>
    </aside>
  )
}
