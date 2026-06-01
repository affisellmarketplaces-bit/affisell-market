/** Masks email for logs (Metabase-safe, no full PII in console). */
export function maskEmailForLog(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.indexOf("@")
  if (at <= 0) return "***"
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}
