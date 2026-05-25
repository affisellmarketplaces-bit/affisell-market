import type { OrderShipExtensionStatus } from "@prisma/client"

import {
  SHIP_EXTENSION_BUYER_RESPONSE_MS,
  SHIP_EXTENSION_SUPPLIER_GRACE_MS,
} from "@/lib/supplier-ship-sla-shared"

export type ShipExtensionRow = {
  status: OrderShipExtensionStatus
  buyerExpiresAt: Date
  newDeadlineAt: Date | null
  createdAt: Date
}

export type ShipPulseCancelInput = {
  now: Date
  deadline: Date
  trackingNumber: string | null
  supplierMessageCount: number
  extensions: ShipExtensionRow[]
}

export type ShipPulseCancelDecision = {
  eligible: boolean
  reason:
    | "has_tracking"
    | "before_deadline"
    | "pending_extension"
    | "accepted_extension_active"
    | "supplier_grace"
    | "extension_rejected"
    | "extension_expired"
    | "accepted_extension_breached"
    | "no_engagement"
}

export function orderHasShipmentTracking(trackingNumber: string | null | undefined): boolean {
  return Boolean(trackingNumber?.trim())
}

function latestExtension(extensions: ShipExtensionRow[]): ShipExtensionRow | null {
  if (extensions.length === 0) return null
  return [...extensions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!
}

export function evaluateShipPulseAutoCancel(input: ShipPulseCancelInput): ShipPulseCancelDecision {
  const nowMs = input.now.getTime()
  const deadlineMs = input.deadline.getTime()

  if (orderHasShipmentTracking(input.trackingNumber)) {
    return { eligible: false, reason: "has_tracking" }
  }
  if (nowMs < deadlineMs) {
    return { eligible: false, reason: "before_deadline" }
  }

  const latest = latestExtension(input.extensions)

  if (latest?.status === "PENDING" && latest.buyerExpiresAt.getTime() > nowMs) {
    return { eligible: false, reason: "pending_extension" }
  }

  if (
    latest?.status === "ACCEPTED" &&
    latest.newDeadlineAt &&
    latest.newDeadlineAt.getTime() > nowMs
  ) {
    return { eligible: false, reason: "accepted_extension_active" }
  }

  if (latest?.status === "REJECTED") {
    return { eligible: true, reason: "extension_rejected" }
  }

  if (latest?.status === "PENDING" && latest.buyerExpiresAt.getTime() <= nowMs) {
    return { eligible: true, reason: "extension_expired" }
  }

  if (
    latest?.status === "ACCEPTED" &&
    latest.newDeadlineAt &&
    latest.newDeadlineAt.getTime() <= nowMs
  ) {
    return { eligible: true, reason: "accepted_extension_breached" }
  }

  if (latest?.status === "EXPIRED") {
    return { eligible: true, reason: "extension_expired" }
  }

  const graceEnds = deadlineMs + SHIP_EXTENSION_SUPPLIER_GRACE_MS
  if (input.supplierMessageCount === 0 && !latest && nowMs < graceEnds) {
    return { eligible: false, reason: "supplier_grace" }
  }

  if (!latest && input.supplierMessageCount > 0 && nowMs < graceEnds) {
    return { eligible: false, reason: "supplier_grace" }
  }

  if (!latest && input.supplierMessageCount === 0 && nowMs >= graceEnds) {
    return { eligible: true, reason: "no_engagement" }
  }

  if (!latest && input.supplierMessageCount > 0 && nowMs >= graceEnds) {
    return { eligible: true, reason: "no_engagement" }
  }

  return { eligible: false, reason: "supplier_grace" }
}

export function buyerExtensionResponseExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + SHIP_EXTENSION_BUYER_RESPONSE_MS)
}
