/** Client-generated draft id for pre-signup document uploads. */
export function createSignupDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24)
  }
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

const DRAFT_ID_RE = /^[a-z0-9]{16,32}$/i

export function isValidSignupDraftId(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return DRAFT_ID_RE.test(value.trim())
}
