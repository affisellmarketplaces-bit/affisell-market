import type { useTranslations } from "next-intl"

/**
 * Ship-tracking validation returns a stable `code` (never localized) plus a French `message` meant only as a
 * server-log/fallback string. The UI must never show that raw message to a non-French supplier — translate by
 * `code` instead, in the `supplierOrders.trackingErrors` namespace (8 locales).
 */

const KNOWN_TRACKING_ERROR_CODES = new Set([
  "carrier_required",
  "tracking_required",
  "tracking_garbage",
  "tracking_format",
  "tracking_not_recognized",
  "other_carrier_blocked",
  "invalid_carrier",
  "tracking_locked",
])

export type TrackingErrorTranslator = ReturnType<typeof useTranslations<"supplierOrders.trackingErrors">>

export function shipTrackingErrorMessage(
  t: TrackingErrorTranslator,
  code: string | null | undefined,
  params?: Record<string, string>
): string {
  const key = code && KNOWN_TRACKING_ERROR_CODES.has(code) ? code : "unknown"
  return t(key, params)
}
