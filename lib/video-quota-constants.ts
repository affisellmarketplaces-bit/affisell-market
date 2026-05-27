/** Free tier: max completed Veo generations per user. */
export const FREE_VIDEO_LIMIT = 3

/**
 * Founder pause on the Pro video paywall (default ON until explicit reactivation).
 *
 * - Unset / `1` / `true` → unlimited generations without Stripe Pro (preview + prod).
 * - `0` / `false` → normal free tier (3 videos) + Pro upsell; optional `VIDEO_PAYWALL_DISABLED=1` for extra bypass.
 *
 * To reactivate the paywall on Vercel: set env `VIDEO_PAYWALL_PAUSED=0`.
 */
export function isVideoPaywallFounderPaused(): boolean {
  const raw = process.env.VIDEO_PAYWALL_PAUSED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "no") return false
  if (raw === "1" || raw === "true" || raw === "yes") return true
  return true
}

/**
 * Extra bypass when founder pause is off (internal testing).
 * Set `VIDEO_PAYWALL_DISABLED=1` — remove or set `0` when Pro gate is active again.
 */
export function isVideoPaywallDisabled(): boolean {
  if (isVideoPaywallFounderPaused()) return true
  const raw = process.env.VIDEO_PAYWALL_DISABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "no") return false
  return raw === "1" || raw === "true" || raw === "yes"
}
