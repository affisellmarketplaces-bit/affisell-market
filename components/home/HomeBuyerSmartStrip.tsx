import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { HomeBuyerFeaturedShopsTile } from "@/components/home/HomeBuyerFeaturedShopsTile"
import { HomeBuyerPremiumRow } from "@/components/home/HomeBuyerPremiumRow"
import { BuyerGlassTile } from "@/components/home/home-buyer-glass-tile"
import { BUYER_SMART_SERVICES } from "@/lib/buyer-smart-services"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"

type Props = {
  featuredShops: PublicShopDirectoryEntry[]
}

/** Buyer shortcuts anchored on the lower edge of the home hero band. */
export async function HomeBuyerSmartStrip({ featuredShops }: Props) {
  const t = await getTranslations("home.buyerServices")
  const tPulse = await getTranslations("pulse")

  const [agent, pulse, catalogue] = BUYER_SMART_SERVICES
  const agentTile = agent
    ? { ...agent, label: t("agent"), hint: t("agentHint") }
    : null
  const pulseTile = pulse
    ? {
        ...pulse,
        label: t("discover"),
        hint: t("discoverMarketHint"),
        liveLabel: tPulse("beta"),
      }
    : null
  const catalogueTile = catalogue
    ? { ...catalogue, label: t("catalog"), hint: t("catalogHint") }
    : null

  return (
    <div
      className="relative mt-10 border-t border-white/20 pt-8 sm:mt-12 sm:pt-10"
      aria-labelledby="buyer-smart-strip-heading"
    >
      <p
        id="buyer-smart-strip-heading"
        className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-100/90"
      >
        {t("sectionBuyer")}
      </p>
      <ul className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {agentTile ? <BuyerGlassTile {...agentTile} /> : null}
        {pulseTile ? (
          <BuyerGlassTile
            {...pulseTile}
            liveBadge={pulseTile.liveBadge}
            liveLabel={pulseTile.liveLabel}
          />
        ) : null}
        <HomeBuyerFeaturedShopsTile shops={featuredShops} />
        {catalogueTile ? <BuyerGlassTile {...catalogueTile} /> : null}
      </ul>
      <HomeBuyerPremiumRow />
    </div>
  )
}
