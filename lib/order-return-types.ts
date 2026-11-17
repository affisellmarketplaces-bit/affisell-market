import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage, pickBinaryLabel } from "@/lib/i18n-pick-message"

export {
  isTerminalReturnStatus,
  ORDER_RETURN_STATUSES,
  TERMINAL_RETURN_STATUSES,
  type OrderReturnStatus,
} from "@/lib/order-return-status"

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

export function getReturnReasonLabel(code: ReturnReasonCode, locale: AppLocale): string {
  const fromBundle = tMessage(locale, `orderReturns.reasons.${code}`, "")
  if (fromBundle && !fromBundle.startsWith("orderReturns.")) return fromBundle
  const row = RETURN_REASON_LABELS[code]
  return pickBinaryLabel({ fr: row.fr, en: row.en }, locale)
}

export function getAutoBuyStatusLabel(status: string, locale: AppLocale): string {
  const key = `orderReturns.autoBuy.${status}`
  const fromBundle = tMessage(locale, key, "")
  if (fromBundle && !fromBundle.startsWith("orderReturns.")) return fromBundle
  return tMessage(locale, "orderReturns.autoBuy.DEFAULT", "Supplier")
}


