import type { SupplierChannelType } from "@prisma/client"

/**
 * Channels where Affisell spends real money buying wholesale on an external site on the
 * supplier's behalf — these require an explicit admin authorization per supplier
 * (`SupplierAutoBuyAuthorization`). Distinct from AFFISELL_NATIVE (supplier fulfills
 * themselves), BLIND_REST (the supplier's own vetted partner API) and MANUAL (a human
 * completes the purchase) — none of those spend platform money on a third-party site.
 */
export const AUTO_BUY_SOURCING_CHANNELS = [
  "ALIEXPRESS",
  "CJ_DROPSHIPPING",
  "BIGBUY",
  "ZENDROP",
  "TEMU",
  "AMAZON",
  "TIKTOK_SHOP",
] as const satisfies readonly SupplierChannelType[]

export type AutoBuySourcingChannel = (typeof AUTO_BUY_SOURCING_CHANNELS)[number]

export function isAutoBuySourcingChannel(
  channel: SupplierChannelType
): channel is AutoBuySourcingChannel {
  return (AUTO_BUY_SOURCING_CHANNELS as readonly string[]).includes(channel)
}

/** Channels with a real API integration today — the rest fall back to a manual job. */
export const AUTO_BUY_LIVE_CHANNELS = ["ALIEXPRESS"] as const satisfies readonly SupplierChannelType[]

export function hasLiveAutoBuyIntegration(channel: SupplierChannelType): boolean {
  return (AUTO_BUY_LIVE_CHANNELS as readonly string[]).includes(channel)
}
