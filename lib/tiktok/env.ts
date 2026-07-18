import "server-only"

/**
 * TikTok Shop env — Affisell Analytics Connector.
 * Supports Partner Center names (TIKTOK_SHOP_*) and legacy Radar names (TIKTOK_*).
 */

export function tiktokAppKey(): string {
  return (
    process.env.TIKTOK_SHOP_APP_KEY?.trim() ||
    process.env.TIKTOK_CLIENT_KEY?.trim() ||
    ""
  )
}

export function tiktokAppSecret(): string {
  return (
    process.env.TIKTOK_SHOP_APP_SECRET?.trim() ||
    process.env.TIKTOK_CLIENT_SECRET?.trim() ||
    ""
  )
}

/** Partner Center App ID (service_id in authorize URL). */
export function tiktokServiceId(): string {
  return (
    process.env.TIKTOK_SHOP_APP_ID?.trim() ||
    process.env.TIKTOK_SHOP_SERVICE_ID?.trim() ||
    ""
  )
}

export function tiktokRedirectUri(): string {
  const explicit =
    process.env.TIKTOK_SHOP_REDIRECT_URI?.trim() ||
    process.env.TIKTOK_REDIRECT_URI?.trim()
  if (explicit) return explicit
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001"
  // Partner Center prod URI uses /api/intelli/tiktok/callback
  return new URL("/api/intelli/tiktok/callback", base).toString()
}

export function assertTikTokCredentials(): void {
  if (!tiktokAppKey() || !tiktokAppSecret()) {
    throw new Error(
      "[tiktok] Missing TIKTOK_SHOP_APP_KEY/TIKTOK_CLIENT_KEY or TIKTOK_SHOP_APP_SECRET/TIKTOK_CLIENT_SECRET"
    )
  }
}
