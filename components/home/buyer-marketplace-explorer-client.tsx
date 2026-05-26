"use client"

import { MarketplaceView } from "@/app/marketplace/marketplace-view"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"

type Props = {
  shell: HomeMarketplaceShell
}

export function BuyerMarketplaceExplorerClient({ shell }: Props) {
  return <MarketplaceView basePath="/" audience="customer" embedded initialBrowse={shell} />
}
