import { getTranslations } from "next-intl/server"

import { BuyerGlassTile } from "@/components/home/home-buyer-glass-tile"
import { buildPremiumBuyerTiles } from "@/lib/home-buyer-premium-tiles"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/** Rangée 2 desktop — enchères, luxe, achat protégé. */
export async function HomeBuyerPremiumRow({ className }: Props) {
  const t = await getTranslations("home.trustHandoff")
  const tServices = await getTranslations("home.buyerServices")
  const tiles = buildPremiumBuyerTiles(t, tServices)

  return (
    <ul
      className={cn(
        "mt-2 grid min-w-0 grid-cols-2 gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-4",
        className
      )}
    >
      {tiles.map((tile) => (
        <BuyerGlassTile key={tile.href} {...tile} />
      ))}
    </ul>
  )
}
