/** Free tier: max completed Veo generations per user. */
export const FREE_VIDEO_LIMIT = 3

/**
 * Bypass free-tier video paywall (internal testing).
 * Set `VIDEO_PAYWALL_DISABLED=1` in env — remove or set `0` to re-enable Stripe Pro gate.
 */
export function isVideoPaywallDisabled(): boolean {
  const raw = process.env.VIDEO_PAYWALL_DISABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "no") return false
  return raw === "1" || raw === "true" || raw === "yes"
}
