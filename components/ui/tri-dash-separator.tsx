import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Tighter spacing for sidebars and compact rails. */
  compact?: boolean
  /** Dark glass sheet — lighter dash contrast. */
  inSheet?: boolean
  /** When set, the dashes become a fold control for an aisle group. */
  collapsed?: boolean
  onToggle?: () => void
  toggleLabel?: string
  controlsId?: string
}

function DashRow({
  compact,
  inSheet,
  collapsed,
}: {
  compact: boolean
  inSheet: boolean
  collapsed: boolean
}) {
  const dashShort = compact ? "w-4 sm:w-5" : "w-5 sm:w-7"
  const dashLong = compact ? "w-6 sm:w-8" : "w-8 sm:w-10"
  return (
    <span className={cn("flex items-center gap-1 sm:gap-1.5", collapsed && "gap-0.5 opacity-70")}>
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
          dashLong,
          collapsed && "via-violet-300"
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
  )
}

/** Futuristic tri-dash divider — three gradient dashes; optional aisle fold control. */
export function TriDashSeparator({
  className,
  compact,
  inSheet,
  collapsed = false,
  onToggle,
  toggleLabel,
  controlsId,
}: Props) {
  const via = inSheet ? "via-violet-400/25" : "via-violet-300/30 dark:via-violet-500/20"
  const to = inSheet ? "to-violet-400/40" : "to-violet-400/50 dark:to-violet-400/40"
  const frame = cn(
    "relative flex items-center justify-center gap-1.5 sm:gap-2",
    compact ? "py-2 sm:py-2.5" : "py-5 sm:gap-3 sm:py-7",
    className
  )
  const wings = (
    <>
      <span className={cn("h-px max-w-[3rem] flex-1 bg-gradient-to-r from-transparent", via, to)} />
      <DashRow compact={Boolean(compact)} inSheet={Boolean(inSheet)} collapsed={collapsed} />
      <span className={cn("h-px max-w-[3rem] flex-1 bg-gradient-to-l from-transparent", via, to)} />
    </>
  )

  if (!onToggle) {
    return (
      <div className={frame} aria-hidden>
        {wings}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        frame,
        "w-full rounded-xl transition-all duration-150",
        "hover:bg-violet-500/[0.06] active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60",
        collapsed && "py-3"
      )}
      aria-expanded={!collapsed}
      aria-controls={controlsId}
      aria-label={toggleLabel}
      title={toggleLabel}
      onClick={onToggle}
    >
      {wings}
    </button>
  )
}
