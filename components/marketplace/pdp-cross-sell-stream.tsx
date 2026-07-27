import { loadPdpCrossSellCards } from "@/lib/pdp-cross-sell-cards.server"

import { PdpCrossSellRail } from "./pdp-cross-sell-rail"

type StreamArgs = {
  listingId: string
  productId: string
  affiliateId: string
  storeSlug?: string | null
  categories: string[]
}

async function safeLoadCards(args: StreamArgs) {
  try {
    return await loadPdpCrossSellCards(args)
  } catch (e) {
    console.log("[pdp-cross-sell]", {
      result: "stream_failed",
      listingId: args.listingId,
      error: e instanceof Error ? e.message : String(e),
    })
    return { oftenBoughtTogether: [], alsoViewed: [] }
  }
}

/**
 * Cross-sell streams must never bubble to app/error.tsx and blank the PDP.
 */
export async function PdpCrossSellCompactStream(args: StreamArgs) {
  const { oftenBoughtTogether } = await safeLoadCards(args)
  if (oftenBoughtTogether.length === 0) return null
  return (
    <PdpCrossSellRail items={oftenBoughtTogether} kind="boughtTogether" variant="compact" />
  )
}

export async function PdpCrossSellFooterStream(args: StreamArgs) {
  const { oftenBoughtTogether, alsoViewed } = await safeLoadCards(args)
  if (oftenBoughtTogether.length === 0 && alsoViewed.length === 0) return null
  return (
    <>
      {oftenBoughtTogether.length > 0 ? (
        <PdpCrossSellRail items={oftenBoughtTogether} kind="boughtTogether" />
      ) : null}
      {alsoViewed.length > 0 ? (
        <PdpCrossSellRail items={alsoViewed} kind="alsoViewed" />
      ) : null}
    </>
  )
}
