import { isAfterShipTrackingValid, registerAfterShipTracking } from "@/lib/aftership-tracking"
import {
  assertOtherCarrierAllowed,
  resolveShipTrackingPolicy,
} from "@/lib/ship-tracking-policy.shared"
import {
  validateShipTrackingFormat,
  type ShipTrackingFormatResult,
} from "@/lib/ship-tracking-validate.shared"

export type { ShipTrackingFormatResult } from "@/lib/ship-tracking-validate.shared"
export {
  isOtherTrustedCarrierLabel,
  normalizeTrackingNumber,
  validateShipTrackingFormat,
} from "@/lib/ship-tracking-validate.shared"
export { resolveShipTrackingPolicy, type ShipTrackingPolicy } from "@/lib/ship-tracking-policy.shared"

export type ShipTrackingValidationResult =
  | { ok: true; normalized: string; verifiedBy: "format" | "aftership" }
  | { ok: false; code: string; message: string }

/**
 * Full ship gate: format + optional AfterShip detect/register.
 * Idempotent — safe to call on validate-preview and mark_shipped.
 */
export async function validateShipTrackingForShip(args: {
  trackingCarrier: string
  trackingNumber: string
  orderId?: string
  customerEmail?: string | null
  register?: boolean
}): Promise<ShipTrackingValidationResult> {
  const policy = resolveShipTrackingPolicy()

  const otherGate = assertOtherCarrierAllowed(args.trackingCarrier, policy)
  if (!otherGate.ok) {
    return { ok: false, code: otherGate.code, message: otherGate.message }
  }

  const format = validateShipTrackingFormat({
    trackingCarrier: args.trackingCarrier,
    trackingNumber: args.trackingNumber,
    policy,
  })
  if (!format.ok) return format

  const requireAfterShip = policy.strictEnforced

  if (!requireAfterShip) {
    return { ok: true, normalized: format.normalized, verifiedBy: "format" }
  }

  const recognized = await isAfterShipTrackingValid(format.normalized, args.trackingCarrier)
  if (!recognized) {
    console.log("[ship-tracking-validate]", {
      orderId: args.orderId ?? null,
      carrier: args.trackingCarrier,
      result: "aftership_reject",
    })
    return {
      ok: false,
      code: "tracking_not_recognized",
      message:
        "Numéro non reconnu par le transporteur. Vérifiez transporteur + numéro avant de confirmer l'expédition.",
    }
  }

  if (args.register !== false && args.orderId) {
    void registerAfterShipTracking({
      trackingNumber: format.normalized,
      carrier: args.trackingCarrier,
      orderId: args.orderId,
      customerEmail: args.customerEmail,
    })
  }

  return { ok: true, normalized: format.normalized, verifiedBy: "aftership" }
}
