import type { LiveEvent } from "@/lib/radar/live-types"

/** A spike with at least this many orders of the same product in the last hour is "hot" (red). */
export const HOT_SPIKE_SALES_PER_HOUR = 5

/**
 * Pin colour on the globe (pure, client-safe). It reads only what is MEASURED: the event type and, for a spike, its real sales
 * per hour. It never reads `growth` — that value is `null` for every real event (it used to be a hash of the event id).
 */
export function pinColor(event: Pick<LiveEvent, "type" | "salesPerHour">): string {
  if (event.type === "sale") return "#22c55e"
  if (event.type === "import") return "#a78bfa"
  if ((event.salesPerHour ?? 0) >= HOT_SPIKE_SALES_PER_HOUR) return "#ef4444"
  return "#f97316"
}
