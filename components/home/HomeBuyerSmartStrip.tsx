import { getTranslations } from "next-intl/server"

import { HomeBuyerFeaturedShopsTile } from "@/components/home/HomeBuyerFeaturedShopsTile"
import { HomeBuyerPremiumRow } from "@/components/home/HomeBuyerPremiumRow"
import { BuyerGlassTile } from "@/components/home/home-buyer-glass-tile"
import { BUYER_SMART_SERVICES } from "@/lib/buyer-smart-services"
import { buildPremiumBuyerTiles } from "@/lib/home-buyer-premium-tiles"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"

type Props = {
  featuredShops: PublicShopDirectoryEntry[]
}

/** Buyer shortcuts — rail swipe mobile · grille desktop. */
export async function HomeBuyerSmartStrip({ featuredShops }: Props) {
  const t = await getTranslations("home.buyerServices")
  const tPulse = await getTranslations("pulse")
  const tTrust = await getTranslations("home.trustHandoff")

  const [agent, pulse, catalogue] = BUYER_SMART_SERVICES
  const agentTile = agent ? { ...agent, label: t("agent"), hint: t("agentHint") } : null
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
  const premiumTiles = buildPremiumBuyerTiles(tTrust, t)

  return (
    <div
      className="relative mt-6 border-t border-white/20 pt-6 sm:mt-10 sm:pt-8 lg:mt-12 lg:pt-10"
      aria-labelledby="buyer-smart-strip-heading"
    >
      <p
        id="buyer-smart-strip-heading"
        className="mb-3 px-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100/90 sm:mb-4 sm:text-[11px] sm:tracking-[0.2em]"
      >
        {t("sectionBuyer")}
      </p>

      {/* Mobile — rail horizontal, snap + fade */}
      <div className="home-buyer-tiles-scroll relative md:hidden">
        <ul className="home-buyer-tiles-rail flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-0.5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {agentTile ? <BuyerGlassTile {...agentTile} /> : null}
          {pulseTile ? (
            <BuyerGlassTile
              {...pulseTile}
              liveBadge={pulseTile.liveBadge}
              liveLabel={pulseTile.liveLabel}
            />
          ) : null}
          <HomeBuyerFeaturedShopsTile
            shops={featuredShops}
            label={t("featured")}
            hint={t("featuredHint")}
            badgeLabel={t("featuredBadge")}
          />
          {catalogueTile ? <BuyerGlassTile {...catalogueTile} /> : null}
          {premiumTiles.map((tile) => (
            <BuyerGlassTile key={`m-${tile.href}`} {...tile} />
          ))}
        </ul>
      </div>

      {/* Tablet + desktop — grille compacte */}
      <ul className="hidden min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid lg:grid-cols-4">
        {agentTile ? <BuyerGlassTile {...agentTile} /> : null}
        {pulseTile ? (
          <BuyerGlassTile
            {...pulseTile}
            liveBadge={pulseTile.liveBadge}
            liveLabel={pulseTile.liveLabel}
          />
        ) : null}
        <HomeBuyerFeaturedShopsTile
          shops={featuredShops}
          label={t("featured")}
          hint={t("featuredHint")}
          badgeLabel={t("featuredBadge")}
        />
        {catalogueTile ? <BuyerGlassTile {...catalogueTile} /> : null}
      </ul>
      <HomeBuyerPremiumRow className="hidden md:grid" />
    </div>
  )
}
