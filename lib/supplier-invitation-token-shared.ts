/** Public invite slug prefix (URL-safe). */
export const SUPPLIER_INVITE_TOKEN_PREFIX = "INV-"

export function normalizeSupplierInviteToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim().toUpperCase()
  if (!t.startsWith(SUPPLIER_INVITE_TOKEN_PREFIX)) return null
  if (t.length < 8 || t.length > 32) return null
  return t
}
