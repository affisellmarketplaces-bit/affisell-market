import { isChinaBuyingAgentId } from "@/lib/china-buying/china-buying-shared"

export type ChinaBuyPrecheckInput = {
  autoFulfill: boolean
  autoBuyEnabled: boolean
  agentId: string | null
  sourceUrl: string | null
  hasPassedQcInspection: boolean
}

export type ChinaBuyPrecheckResult =
  | { ok: true }
  | { ok: false; reason: "auto_fulfill_off" | "auto_buy_off" | "no_agent" | "invalid_url" | "qc_required" }

/** Pure gate before routing a paid order to a China buying agent. */
export function precheckChinaBuyRoute(input: ChinaBuyPrecheckInput): ChinaBuyPrecheckResult {
  if (!input.autoFulfill) {
    return { ok: false, reason: "auto_fulfill_off" }
  }
  if (!input.autoBuyEnabled) {
    return { ok: false, reason: "auto_buy_off" }
  }
  if (!input.agentId || !isChinaBuyingAgentId(input.agentId)) {
    return { ok: false, reason: "no_agent" }
  }
  const sourceUrl = input.sourceUrl?.trim()
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, reason: "invalid_url" }
  }
  if (!input.hasPassedQcInspection) {
    return { ok: false, reason: "qc_required" }
  }
  return { ok: true }
}
