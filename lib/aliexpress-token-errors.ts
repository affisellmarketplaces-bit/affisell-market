/** Shared AliExpress OAuth / session error classification (client-safe). */

export const ALIEXPRESS_OAUTH_START_PATH = "/api/aliexpress/oauth/start"

export function isAliExpressIllegalAccessTokenError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("illegalaccesstoken") ||
    m.includes("access token is invalid") ||
    m.includes("token is invalid or expired") ||
    m.includes("invalid session") ||
    m.includes("sessionkey is invalid")
  )
}

export function isAliExpressRefreshTokenError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("refresh_token") ||
    m.includes("refresh token") ||
    m.includes("invalid refresh") ||
    m.includes("refresh token expired")
  )
}

export type AliExpressTokenErrorKind = "expired_access" | "refresh_failed" | "missing" | null

export function classifyAliExpressTokenError(message: string): AliExpressTokenErrorKind {
  if (!message.trim()) return null
  if (/tokens missing|refresh_token required|no refresh_token/i.test(message)) return "missing"
  if (isAliExpressRefreshTokenError(message)) return "refresh_failed"
  if (isAliExpressIllegalAccessTokenError(message)) return "expired_access"
  return null
}

export function aliExpressOAuthReconnectHint(kind: AliExpressTokenErrorKind): string {
  switch (kind) {
    case "expired_access":
      return `Session OAuth expirée — reconnectez AliExpress : ${ALIEXPRESS_OAUTH_START_PATH}`
    case "refresh_failed":
      return `Refresh token invalide — relancez OAuth : ${ALIEXPRESS_OAUTH_START_PATH}`
    case "missing":
      return `Aucune session OAuth — autorisez l’app : ${ALIEXPRESS_OAUTH_START_PATH}`
    default:
      return ""
  }
}

export function extractAliExpressApiErrorFromWarnings(warnings: string[]): string | null {
  for (const w of warnings) {
    const m = w.match(/^API AliExpress\s*:\s*(.+)/i)
    if (!m?.[1]?.trim()) continue
    const msg = m[1].trim().replace(/\s*—\s*tentative scraping.*$/i, "").trim()
    if (msg) return msg
  }
  return null
}

export function resolveDropForgeApiError(args: {
  agentOk: boolean
  agentError?: string | null
  agentApiError?: string | null
  warnings?: string[]
}): string | null {
  if (args.agentApiError?.trim()) return args.agentApiError.trim()
  const fromWarnings = extractAliExpressApiErrorFromWarnings(args.warnings ?? [])
  if (fromWarnings) return fromWarnings
  if (!args.agentOk && args.agentError?.trim()) {
    const err = args.agentError.trim()
    if (classifyAliExpressTokenError(err)) return err
  }
  return null
}
