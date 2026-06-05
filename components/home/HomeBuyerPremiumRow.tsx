import { Crown, Gavel, ShieldCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { BuyerGlassTile } from "@/components/home/home-buyer-glass-tile"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"

/** Rangée 2 — enchères, luxe, achat protégé (même tuiles glass que rangée 1). */
export async function HomeBuyerPremiumRow() {
  const t = await getTranslations("home.trustHandoff")
  const tServices = await getTranslations("home.buyerServices")

  const tiles = [
    {
      href: "/auctions",
      label: tServices("auctions"),
      hint: tServices("auctionsHint"),
      Icon: Gavel,
      accent: BUYER_TILE_ACCENTS.auctions.glow,
    },
    {
      href: "/luxe",
      label: tServices("luxe"),
      hint: tServices("luxeHint"),
      Icon: Crown,
      accent: BUYER_TILE_ACCENTS.luxe.glow,
    },
    {
      href: "/returns",
      label: t("trustTitle"),
      hint: t("trustBody"),
      Icon: ShieldCheck,
      accent: BUYER_TILE_ACCENTS.support.glow,
    },
  ] as const

  return (
    <ul className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <BuyerGlassTile key={tile.href} {...tile} />
      ))}
    </ul>
  )
}
