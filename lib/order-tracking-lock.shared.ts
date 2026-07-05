export type OrderTrackingVerificationMethod = "format" | "aftership" | "partner" | "legacy"

export type OrderTrackingLockSnapshot = {
  trackingLockedAt: Date | string | null
  trackingNumber: string | null
  status: string
}

/** Supplier cannot replace tracking once locked (AfterShip-validated or legacy shipped rows). */
export function isSupplierTrackingLocked(order: OrderTrackingLockSnapshot): boolean {
  if (order.trackingLockedAt) return true
  return Boolean(order.trackingNumber?.trim()) && order.status === "shipped"
}

export type SupplierTrackingGateResult =
  | { ok: true }
  | { ok: false; code: "tracking_locked"; message: string }

export function assertSupplierMayRegisterTracking(
  order: OrderTrackingLockSnapshot,
  nextTracking?: string | null
): SupplierTrackingGateResult {
  if (!isSupplierTrackingLocked(order)) return { ok: true }

  const existing = order.trackingNumber?.trim().toLowerCase() ?? ""
  const next = nextTracking?.trim().toLowerCase() ?? ""
  if (existing && next && existing === next) return { ok: true }

  return {
    ok: false,
    code: "tracking_locked",
    message:
      "Le numéro de suivi est verrouillé après validation transporteur. Contactez le support Affisell en cas d'erreur.",
  }
}

export function trackingLockWriteFields(verifiedBy: OrderTrackingVerificationMethod): {
  trackingLockedAt: Date
  trackingVerifiedBy: OrderTrackingVerificationMethod
} {
  return { trackingLockedAt: new Date(), trackingVerifiedBy: verifiedBy }
}
