import {
  affisellCommissionPercentToBps,
  clampAffisellCommissionRateBps,
} from "@/lib/affisell-platform-commission"

/** Parse supplier product body field for Affisell platform fee override. */
export function parseAffisellCommissionOverrideFromBody(
  raw: unknown
): number | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null || raw === "") return null

  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 0 && raw <= 50) return affisellCommissionPercentToBps(raw)
    if (raw > 50) return clampAffisellCommissionRateBps(raw)
    return null
  }

  if (typeof raw === "string") {
    const t = raw.trim()
    if (!t) return null
    const n = Number(t)
    if (!Number.isFinite(n)) return undefined
    if (n > 0 && n <= 50) return affisellCommissionPercentToBps(n)
    return clampAffisellCommissionRateBps(n)
  }

  return undefined
}
