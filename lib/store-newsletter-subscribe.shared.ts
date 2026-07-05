/** Normalize + validate storefront newsletter email (shared client/server). */
export function normalizeStoreNewsletterEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || trimmed.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  return trimmed
}
