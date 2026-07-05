export type ShipTrackingPolicyInput = {
  shipTrackingStrict?: string | null
  afterShipApiKey?: string | null
  nodeEnv?: string
}

export type ShipTrackingPolicy = {
  strictEnforced: boolean
  otherCarrierAllowed: boolean
}

export const OTHER_CARRIER_BLOCKED_CODE = "other_carrier_blocked"

export const OTHER_CARRIER_BLOCKED_MESSAGE =
  "Choisissez un transporteur de la liste — « Autre » n'est pas accepté sans vérification transporteur."

/** Mirrors lib/ship-tracking-validate.ts afterShipRequired — safe for client + server. */
export function resolveShipTrackingPolicy(
  input?: ShipTrackingPolicyInput
): ShipTrackingPolicy {
  const shipTrackingStrict =
    input?.shipTrackingStrict ??
    (typeof process !== "undefined" ? process.env.SHIP_TRACKING_STRICT : undefined)
  if (shipTrackingStrict === "0") {
    return { strictEnforced: false, otherCarrierAllowed: true }
  }

  const afterShipApiKey =
    input?.afterShipApiKey ??
    (typeof process !== "undefined" ? process.env.AFTERSHIP_API_KEY : undefined)
  if (afterShipApiKey?.trim()) {
    return { strictEnforced: true, otherCarrierAllowed: false }
  }

  const nodeEnv =
    input?.nodeEnv ?? (typeof process !== "undefined" ? process.env.NODE_ENV : undefined)
  if (nodeEnv === "production") {
    return { strictEnforced: true, otherCarrierAllowed: false }
  }

  return { strictEnforced: false, otherCarrierAllowed: true }
}

export function assertOtherCarrierAllowed(
  carrierLabel: string,
  policy?: ShipTrackingPolicy
): { ok: true } | { ok: false; code: typeof OTHER_CARRIER_BLOCKED_CODE; message: string } {
  const resolved = policy ?? resolveShipTrackingPolicy()
  const isOther = carrierLabel.trim() === "Autre"
  if (isOther && !resolved.otherCarrierAllowed) {
    return { ok: false, code: OTHER_CARRIER_BLOCKED_CODE, message: OTHER_CARRIER_BLOCKED_MESSAGE }
  }
  return { ok: true }
}
