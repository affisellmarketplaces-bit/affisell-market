"use client"

import { cn } from "@/lib/utils"

type Props = {
  expanded: boolean
  onClick: () => void
  label: string
  className?: string
  /** Dark glass sheet. */
  inSheet?: boolean
  /** Compact header control vs tall dock rail. */
  size?: "header" | "rail"
}

/** Three horizontal dashes — Amazon-grade aisle fold, Affisell glow. */
export function TriDashHandle({
  expanded,
  onClick,
  label,
  className,
  inSheet = false,
  size = "header",
}: Props) {
  const rail = size === "rail"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      className={cn(
        "affisell-tri-dash-handle group/dash relative flex items-center justify-center rounded-xl transition-all duration-200",
        "hover:scale-[1.04] active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2",
        rail
          ? "min-h-14 min-w-11 flex-col gap-1.5 px-2 py-3"
          : "size-11 flex-col gap-[5px] px-2.5",
        inSheet
          ? "text-violet-200 hover:bg-white/10"
          : "text-white hover:bg-white/15 dark:hover:bg-white/10",
        !expanded && "affisell-tri-dash-handle--folded",
        className
      )}
    >
      <span
        className={cn(
          "affisell-tri-dash-handle__bar block rounded-full",
          rail ? "h-[2.5px] w-6" : "h-0.5 w-[1.15rem]",
          inSheet ? "bg-violet-200/90" : "bg-white/90"
        )}
        aria-hidden
      />
      <span
        className={cn(
          "affisell-tri-dash-handle__bar affisell-tri-dash-center block rounded-full",
          rail ? "h-[2.5px] w-7" : "h-0.5 w-5",
          "bg-gradient-to-r from-fuchsia-300 via-white to-sky-300"
        )}
        aria-hidden
      />
      <span
        className={cn(
          "affisell-tri-dash-handle__bar block rounded-full",
          rail ? "h-[2.5px] w-6" : "h-0.5 w-[1.15rem]",
          inSheet ? "bg-violet-200/90" : "bg-white/90"
        )}
        aria-hidden
      />
    </button>
  )
}
