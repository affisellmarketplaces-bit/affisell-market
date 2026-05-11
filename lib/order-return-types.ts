export const ORDER_RETURN_STATUSES = [
  "REQUESTED",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT",
  "RECEIVED",
  "REFUNDED",
  "REJECTED",
  "CANCELLED",
] as const

export type OrderReturnStatus = (typeof ORDER_RETURN_STATUSES)[number]

export const RETURN_REASON_CODES = [
  "NOT_AS_DESCRIBED",
  "DEFECTIVE_OR_BROKEN",
  "WRONG_ITEM",
  "SIZE_OR_FIT",
  "CHANGED_MIND",
  "DAMAGED_IN_SHIPPING",
  "OTHER",
] as const

export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number]

export const RETURN_REASON_LABELS: Record<ReturnReasonCode, { en: string; fr: string }> = {
  NOT_AS_DESCRIBED: { en: "Item not as described", fr: "Article non conforme à la description" },
  DEFECTIVE_OR_BROKEN: { en: "Defective or broken", fr: "Défectueux ou cassé" },
  WRONG_ITEM: { en: "Wrong item received", fr: "Mauvais article reçu" },
  SIZE_OR_FIT: { en: "Size or fit issue", fr: "Taille ou coupe" },
  CHANGED_MIND: { en: "Changed mind", fr: "Changement d’avis" },
  DAMAGED_IN_SHIPPING: { en: "Damaged in shipping", fr: "Endommagé pendant l’envoi" },
  OTHER: { en: "Other", fr: "Autre" },
}

export const TERMINAL_RETURN_STATUSES: OrderReturnStatus[] = ["REJECTED", "REFUNDED", "CANCELLED"]

export function isTerminalReturnStatus(s: string): boolean {
  return TERMINAL_RETURN_STATUSES.includes(s as OrderReturnStatus)
}
