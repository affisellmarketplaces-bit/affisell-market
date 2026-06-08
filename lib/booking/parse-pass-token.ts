/** Extract booking pass token from a pasted URL or raw token string. */
export function parseBookingPassTokenInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    if (trimmed.includes("://") || trimmed.startsWith("/")) {
      const path = trimmed.includes("://")
        ? new URL(trimmed).pathname
        : trimmed.split("?")[0] ?? trimmed
      const match = path.match(/\/booking\/pass\/([^/?#]+)/i)
      if (match?.[1]) return decodeURIComponent(match[1]).trim()
    }
  } catch {
    // fall through to raw token
  }

  const pathMatch = trimmed.match(/\/booking\/pass\/([^/?#\s]+)/i)
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim()

  if (/^[a-f0-9]{32,64}$/i.test(trimmed)) return trimmed
  return null
}
