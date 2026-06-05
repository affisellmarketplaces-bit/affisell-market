import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Tighter spacing for sidebars and compact rails. */
  compact?: boolean
  /** Dark glass sheet — lighter dash contrast. */
  inSheet?: boolean
}

/** Futuristic tri-dash divider — three gradient dashes between catalog tiers. */
export function TriDashSeparator({ className, compact, inSheet }: Props) {
  const dashShort = compact ? "w-4 sm:w-5" : "w-5 sm:w-7"
  const dashLong = compact ? "w-6 sm:w-8" : "w-8 sm:w-10"
  const via = inSheet ? "via-violet-400/25" : "via-violet-300/30 dark:via-violet-500/20"
  const to = inSheet ? "to-violet-400/40" : "to-violet-400/50 dark:to-violet-400/40"

  return (
    <div
      className={cn(
        "relative flex items-center justify-center gap-1.5 sm:gap-2",
        compact ? "py-2 sm:py-2.5" : "py-5 sm:gap-3 sm:py-7",
        className
      )}
      aria-hidden
    >
      <span className={cn("h-px max-w-[3rem] flex-1 bg-gradient-to-r from-transparent", via, to)} />
      <span className="flex items-center gap-1 sm:gap-1.5">
        <span
          className={cn(
            "h-0.5 rounded-full bg-gradient-to-r from-violet-400/40 to-violet-500/80",
            dashShort,
            inSheet && "from-violet-300/30 to-violet-400/70"
          )}
        />
        <span
          className={cn(
            "affisell-tri-dash-center h-0.5 rounded-full bg-gradient-to-r from-fuchsia-400/70 via-violet-400 to-sky-400/70",
            dashLong
          )}
        />
        <span
          className={cn(
            "h-0.5 rounded-full bg-gradient-to-l from-violet-400/40 to-violet-500/80",
            dashShort,
            inSheet && "from-violet-300/30 to-violet-400/70"
          )}
        />
      </span>
      <span className={cn("h-px max-w-[3rem] flex-1 bg-gradient-to-l from-transparent", via, to)} />
    </div>
  )
}
