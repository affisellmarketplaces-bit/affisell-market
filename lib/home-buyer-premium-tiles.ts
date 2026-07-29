import { Crown, Gavel, ShieldCheck } from "lucide-react"

import type { BuyerGlassTileProps } from "@/components/home/home-buyer-glass-tile"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"

type Translator = (key: string) => string

/**
 * Rangée 2 desktop (hors hero purple primary band) — auctions / luxe / trust.
 * Hub Battles lives in PublicNav (2ᵉ bande chrome), not here.
 */
export function buildPremiumBuyerTiles(
  t: Translator,
  tServices: Translator
): BuyerGlassTileProps[] {
  return [
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
      href: "/protected-checkout",
      label: t("trustTitle"),
      hint: t("trustBody"),
      Icon: ShieldCheck,
      accent: BUYER_TILE_ACCENTS.support.glow,
    },
  ]
}
