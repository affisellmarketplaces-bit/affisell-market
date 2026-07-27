import type { PulseFeedItem } from "@/lib/pulse-feed-types"

/** Canonical PDP URL for a Pulse feed item (shop listing or marketplace fallback). */
export function resolvePulseItemDetailHref(item: Pick<PulseFeedItem, "href" | "listingId">): string {
  const href = item.href?.trim()
  if (href) return href
  if (item.listingId?.trim()) return `/marketplace/${item.listingId}`
  return "/marketplace"
}
