import { loadPdpCrossSellCards } from "@/lib/pdp-cross-sell-cards.server"

import { PdpCrossSellRail } from "./pdp-cross-sell-rail"

type StreamArgs = {
  listingId: string
  productId: string
  affiliateId: string
  storeSlug?: string | null
  categories: string[]
}

export async function PdpCrossSellCompactStream(args: StreamArgs) {
  const { oftenBoughtTogether } = await loadPdpCrossSellCards(args)
  if (oftenBoughtTogether.length === 0) return null
  return (
    <PdpCrossSellRail items={oftenBoughtTogether} kind="boughtTogether" variant="compact" />
  )
}

export async function PdpCrossSellFooterStream(args: StreamArgs) {
  const { oftenBoughtTogether, alsoViewed } = await loadPdpCrossSellCards(args)
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
