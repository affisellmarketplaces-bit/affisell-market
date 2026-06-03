import type { SentinelTrendPoint } from "@/lib/sentinel/types"
import { cn } from "@/lib/utils"

type Props = {
  points: SentinelTrendPoint[]
}

const BAR_AREA_PX = 88

function formatDayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00.000Z`)
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(d)
}

function scoreTone(score: number): string {
  if (score >= 85) return "bg-emerald-500/80"
  if (score >= 60) return "bg-amber-500/80"
  return "bg-rose-500/80"
}

export function SentinelTrendStrip({ points }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Tendance 7 jours · health score
      </p>
      <div className="flex gap-1.5 sm:gap-2">
        {points.map((p) => {
          const hasData = p.score != null
          const score = p.score ?? 0
          const barPx = hasData ? Math.max(4, Math.round((score / 100) * BAR_AREA_PX)) : 4
          return (
            <div key={p.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  hasData ? "text-zinc-500" : "text-zinc-700"
                )}
              >
                {hasData ? score : "—"}
              </span>
              <div
                className="flex w-full items-end justify-center"
                style={{ height: BAR_AREA_PX }}
                title={
                  hasData
                    ? `${p.day}: score ${score}, ${p.openTotal} signal(s) ouvert(s)`
                    : `${p.day}: aucun scan`
                }
              >
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all",
                    hasData ? scoreTone(score) : "bg-zinc-800/50"
                  )}
                  style={{ height: barPx }}
                />
              </div>
              <span className="truncate text-[9px] uppercase text-zinc-600">{formatDayLabel(p.day)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
