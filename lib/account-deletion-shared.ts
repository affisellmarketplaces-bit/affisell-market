export type AccountDeletionBlockCode = "HAS_ORDERS" | "OPEN_BUYER_ORDERS"

export type AccountDeletionImpactScope = "supplier" | "affiliate" | "buyer"

export type AccountDeletionReasonCode =
  | "too_complex"
  | "missing_features"
  | "pricing_fees"
  | "found_alternative"
  | "low_sales"
  | "support_issue"
  | "compliance_kyc"
  | "privacy_data"
  | "taking_break"
  | "other"

export const ACCOUNT_DELETION_REASON_CODES = [
  "too_complex",
  "missing_features",
  "pricing_fees",
  "found_alternative",
  "low_sales",
  "support_issue",
  "compliance_kyc",
  "privacy_data",
  "taking_break",
  "other",
] as const satisfies readonly AccountDeletionReasonCode[]

export type AccountDeletionSource = "merchant" | "gdpr"

export type AccountDeletionPreview = {
  email: string
  role: string
  roleLabel: string
  canDelete: boolean
  blockCode?: AccountDeletionBlockCode
  impactScope: AccountDeletionImpactScope
  reasonCodes: AccountDeletionReasonCode[]
}

export type AccountDeletionConfirmPayload = {
  confirmEmail?: string
  /** Legacy GDPR body — still accepted for idempotent API clients. */
  confirm?: string
  reasonCode?: string
  reasonDetail?: string
  locale?: string
  source?: AccountDeletionSource
}

export type AccountDeletionReasonParseResult =
  | {
      ok: true
      reasonCode: AccountDeletionReasonCode
      reasonDetail: string | null
    }
  | { ok: false; code: "REASON_REQUIRED" | "REASON_INVALID" | "REASON_DETAIL_REQUIRED" | "REASON_DETAIL_TOO_LONG" }

const REASON_DETAIL_MAX = 500
const REASON_DETAIL_OTHER_MIN = 10

export function normalizeAccountDeletionEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isAccountDeletionReasonCode(value: string): value is AccountDeletionReasonCode {
  return (ACCOUNT_DELETION_REASON_CODES as readonly string[]).includes(value)
}

export function parseAccountDeletionReason(
  payload: Pick<AccountDeletionConfirmPayload, "reasonCode" | "reasonDetail">
): AccountDeletionReasonParseResult {
  const rawCode = payload.reasonCode?.trim()
  if (!rawCode) return { ok: false, code: "REASON_REQUIRED" }
  if (!isAccountDeletionReasonCode(rawCode)) return { ok: false, code: "REASON_INVALID" }

  const detail = payload.reasonDetail?.trim() ?? ""
  if (detail.length > REASON_DETAIL_MAX) {
    return { ok: false, code: "REASON_DETAIL_TOO_LONG" }
  }

  if (rawCode === "other" && detail.length < REASON_DETAIL_OTHER_MIN) {
    return { ok: false, code: "REASON_DETAIL_REQUIRED" }
  }

  return {
    ok: true,
    reasonCode: rawCode,
    reasonDetail: detail.length > 0 ? detail : null,
  }
}

/** Typed email confirmation — reason is validated separately. */
export function isAccountDeletionConfirmed(
  payload: AccountDeletionConfirmPayload,
  accountEmail: string
): boolean {
  const normalizedAccount = normalizeAccountDeletionEmail(accountEmail)
  if (payload.confirmEmail != null && payload.confirmEmail.trim() !== "") {
    return normalizeAccountDeletionEmail(payload.confirmEmail) === normalizedAccount
  }
  return payload.confirm === "DELETE"
}

export function accountDeletionReasonErrorCode(
  code: "REASON_REQUIRED" | "REASON_INVALID" | "REASON_DETAIL_REQUIRED" | "REASON_DETAIL_TOO_LONG"
): string {
  switch (code) {
    case "REASON_REQUIRED":
      return "Select a reason before deleting your account."
    case "REASON_INVALID":
      return "Invalid deletion reason."
    case "REASON_DETAIL_REQUIRED":
      return "Please briefly describe your reason (at least 10 characters)."
    case "REASON_DETAIL_TOO_LONG":
      return "Reason detail is too long."
  }
}
