export type AccountDeletionBlockCode = "HAS_ORDERS" | "OPEN_BUYER_ORDERS"

export type AccountDeletionImpactScope = "supplier" | "affiliate" | "buyer"

export type AccountDeletionPreview = {
  email: string
  role: string
  roleLabel: string
  canDelete: boolean
  blockCode?: AccountDeletionBlockCode
  impactScope: AccountDeletionImpactScope
}

export type AccountDeletionConfirmPayload = {
  confirmEmail?: string
  /** Legacy GDPR body — still accepted for idempotent API clients. */
  confirm?: string
}

export function normalizeAccountDeletionEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Typed email confirmation — no churn survey, no free-text reason. */
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
