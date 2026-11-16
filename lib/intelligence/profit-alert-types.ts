import type { ProfitAlertCandidate } from "@/lib/intelligence/profit-alerts"

/** What is stored in ResellerProfitAlert.payload (everything needed to explain the alert later, in any language). */
export type ProfitAlertPayload = Pick<
  ProfitAlertCandidate,
  | "name"
  | "primaryCause"
  | "causes"
  | "previousNetCents"
  | "currentNetCents"
  | "netChangeCents"
  | "previousOrders"
  | "currentOrders"
  | "sinceIso"
  | "sinceKind"
  | "periodStartIso"
  | "periodEndIso"
  | "effects"
  | "suggestion"
>

export const PROFIT_ALERT_NOTIF = "PROFIT_ALERT" as const
export const PROFIT_ALERT_CHANNELS = ["in_app", "email"] as const
export type ProfitAlertChannel = (typeof PROFIT_ALERT_CHANNELS)[number]

export function toProfitAlertPayload(c: ProfitAlertCandidate): ProfitAlertPayload {
  return {
    name: c.name,
    primaryCause: c.primaryCause,
    causes: c.causes,
    previousNetCents: c.previousNetCents,
    currentNetCents: c.currentNetCents,
    netChangeCents: c.netChangeCents,
    previousOrders: c.previousOrders,
    currentOrders: c.currentOrders,
    sinceIso: c.sinceIso,
    sinceKind: c.sinceKind,
    periodStartIso: c.periodStartIso,
    periodEndIso: c.periodEndIso,
    effects: c.effects,
    suggestion: c.suggestion,
  }
}
