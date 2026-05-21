import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type HealthBadgeProps = {
  status: "ACTIVE" | "INACTIVE" | "ERROR"
  latency?: number | null
}

export function HealthBadge({ status, latency }: HealthBadgeProps) {
  const latencyLabel =
    latency != null && latency > 0 ? (
      <span className="ml-1 font-normal opacity-80">{latency}ms</span>
    ) : null

  if (status === "ACTIVE") {
    return (
      <Badge
        className={cn(
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        )}
      >
        OK
        {latencyLabel}
      </Badge>
    )
  }

  if (status === "ERROR") {
    return (
      <Badge className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        ERROR
        {latencyLabel}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="text-zinc-600 dark:text-zinc-400">
      INACTIVE
    </Badge>
  )
}
