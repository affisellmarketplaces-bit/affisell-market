import type { SentinelTrendPoint } from "@/lib/sentinel/types"
import { cn } from "@/lib/utils"

type Props = {
  points: SentinelTrendPoint[]
}

function formatDayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00.000Z`)
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(d)
}

export function SentinelTrendStrip({ points }: Props) {
  const maxScore = 100
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Tendance 7 jours · health score
      </p>
      <div className="flex h-28 items-end gap-1.5 sm:gap-2">
        {points.map((p) => {
          const height = Math.max(8, Math.round((p.score / maxScore) * 100))
          const tone =
            p.score >= 85 ? "bg-emerald-500/80" : p.score >= 60 ? "bg-amber-500/80" : "bg-rose-500/80"
          return (
            <div key={p.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-zinc-500">{p.score}</span>
              <div
                className={cn("w-full rounded-t-md transition-all", tone)}
                style={{ height: `${height}%` }}
                title={`${p.day}: score ${p.score}, ${p.openTotal} signal(s) ouvert(s)`}
              />
              <span className="truncate text-[9px] uppercase text-zinc-600">{formatDayLabel(p.day)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
