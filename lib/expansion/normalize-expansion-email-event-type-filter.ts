import type { ExpansionEmailEventRow } from "@/lib/admin/load-expansion-email-event-rows"

const VALID_EVENT_TYPES = new Set<ExpansionEmailEventRow["eventType"]>([
  "delivered",
  "bounce",
  "complaint",
])

export function normalizeExpansionEmailEventTypeFilter(
  raw: string | null | undefined
): ExpansionEmailEventRow["eventType"] | undefined {
  const eventType = raw?.trim().toLowerCase()
  if (!eventType || !VALID_EVENT_TYPES.has(eventType as ExpansionEmailEventRow["eventType"])) {
    return undefined
  }
  return eventType as ExpansionEmailEventRow["eventType"]
}
