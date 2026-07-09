/** Client-safe share channel recommendation (no Prisma). */

export type ShareChannelId = "whatsapp" | "twitter" | "native" | "clipboard" | "embed"

export type ShareChannelRecommendationInput = {
  embedEnabled: boolean
  nativeShareAvailable: boolean
  isMobile: boolean
  /** BCP-47 or short code — `fr` prefers WhatsApp on desktop. */
  locale?: string
}

export function isLikelyMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
}

/** Pick the highest-conversion channel for this merchant context. */
export function recommendShareChannel(input: ShareChannelRecommendationInput): ShareChannelId {
  if (!input.embedEnabled) return "embed"
  if (input.nativeShareAvailable && input.isMobile) return "native"
  if (input.isMobile) return "whatsapp"
  const locale = (input.locale ?? "").toLowerCase()
  if (locale.startsWith("fr")) return "whatsapp"
  return "twitter"
}

/** Social channels in UI order — recommended channel first. */
export function orderSocialShareChannels(
  recommended: ShareChannelId
): Array<"whatsapp" | "twitter"> {
  const base: Array<"whatsapp" | "twitter"> = ["whatsapp", "twitter"]
  if (recommended !== "whatsapp" && recommended !== "twitter") return base
  if (recommended === "whatsapp") return base
  return ["twitter", "whatsapp"]
}

export const AFFISELL_SHARE_SENT_STORAGE_PREFIX = "affisell_share_sent_"

export function readShareSentFlag(slug: string): boolean {
  if (typeof window === "undefined" || !slug) return false
  try {
    return window.localStorage.getItem(`${AFFISELL_SHARE_SENT_STORAGE_PREFIX}${slug}`) === "1"
  } catch {
    return false
  }
}

export function markShareSentFlag(slug: string): void {
  if (typeof window === "undefined" || !slug) return
  try {
    window.localStorage.setItem(`${AFFISELL_SHARE_SENT_STORAGE_PREFIX}${slug}`, "1")
  } catch {
    // ignore quota / private mode
  }
}
