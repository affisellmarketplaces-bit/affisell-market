import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { missionControlPanel } from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { cn } from "@/lib/utils"

export type KpiTone = "neutral" | "good" | "warn" | "danger"

const TONE: Record<KpiTone, string> = {
  neutral: "",
  good: "ring-1 ring-emerald-300/60 dark:ring-emerald-800/60",
  warn: "ring-1 ring-amber-300/80 dark:ring-amber-800/70",
  danger: "ring-2 ring-red-400/70 dark:ring-red-800/70",
}

/** One headline number that opens the page where it can be acted on. Tone carries urgency (red / amber / green). */
export function KpiTile({
  href,
  Icon,
  label,
  value,
  sub,
  tone = "neutral",
  children,
}: {
  href: string
  Icon: LucideIcon
  label: string
  value: string
  sub?: React.ReactNode
  tone?: KpiTone
  children?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        missionControlPanel,
        "group flex min-w-0 flex-col justify-between gap-2 p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:gap-3 sm:p-4",
        TONE[tone]
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:gap-2 sm:text-[11px] sm:tracking-wider">
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            tone === "danger" && "text-red-600 dark:text-red-400",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "good" && "text-emerald-600 dark:text-emerald-400"
          )}
          aria-hidden
        />
        <span className="line-clamp-1">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl",
              tone === "danger" && "text-red-700 dark:text-red-300"
            )}
          >
            {value}
          </p>
          {sub ? <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{sub}</p> : null}
        </div>
        {children}
      </div>
    </Link>
  )
}
