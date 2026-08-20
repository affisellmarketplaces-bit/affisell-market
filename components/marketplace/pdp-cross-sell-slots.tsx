import { Suspense } from "react"

import { PdpCrossSellRailSkeleton } from "@/components/marketplace/pdp-cross-sell-rail-skeleton"
import {
  PdpCrossSellCompactStream,
  PdpCrossSellFooterStream,
} from "@/components/marketplace/pdp-cross-sell-stream"

type StreamArgs = {
  listingId: string
  productId: string
  affiliateId: string
  storeSlug?: string | null
  categories: string[]
}

/** Stable PDP slot — avoids key warnings when passed into motion.div trees. */
export function PdpCompactCrossSellSlot(args: StreamArgs) {
  return (
    <Suspense fallback={null}>
      <PdpCrossSellCompactStream {...args} />
    </Suspense>
  )
}

export function PdpFooterCrossSellSlot(args: StreamArgs) {
  return (
    <Suspense fallback={<PdpCrossSellRailSkeleton />}>
      <PdpCrossSellFooterStream {...args} />
    </Suspense>
  )
}
