import type { DigitalAccessPlaceholders } from "@/lib/digital-delivery/types"

const PLACEHOLDER_PATTERN = /\{\{(orderId|token|email)\}\}/g

/** Substitute {{orderId}}, {{token}}, {{email}} in supplier-configured access URLs. */
export function resolveDigitalAccessUrl(
  template: string,
  placeholders: DigitalAccessPlaceholders
): string {
  const trimmed = template.trim()
  if (!trimmed) return trimmed
  return trimmed.replace(PLACEHOLDER_PATTERN, (_, key: string) => {
    if (key === "orderId") return encodeURIComponent(placeholders.orderId)
    if (key === "token") return encodeURIComponent(placeholders.token)
    if (key === "email") return encodeURIComponent(placeholders.email)
    return ""
  })
}

export function isValidDigitalAccessUrl(raw: string): boolean {
  const u = raw.trim()
  if (!u) return false
  try {
    const parsed = new URL(u.includes("{{") ? "https://example.com/path" : u)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return u.includes("{{") && u.length >= 8
  }
}
