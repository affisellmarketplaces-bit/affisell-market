import { getTranslations } from "next-intl/server"
import { headers } from "next/headers"

import { BuyerHeroSearch } from "@/components/BuyerHeroSearch"
import { CheckoutRegionComingSoonBanner } from "@/components/marketplace/checkout-region-coming-soon-banner"
import { GraduatedCheckoutPermanentBanner } from "@/components/marketplace/graduated-checkout-permanent-banner"
import { RolloutShippingConfirmedBanner } from "@/components/marketplace/rollout-shipping-confirmed-banner"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { HomeBuyerSmartStrip } from "@/components/home/HomeBuyerSmartStrip"
import { homeHeroShell } from "@/components/home/home-hero-tokens"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { FastLink } from "@/components/navigation/fast-link"
import { loadFeaturedShopsCached } from "@/lib/public-home-cache"
import {
  isGraduatedCheckoutCountryResolved,
  isRolloutOnlyCheckoutCountryResolved,
  isStripeCheckoutCountryResolved,
  resolveLiveCheckoutCountryCount,
} from "@/lib/checkout-country-rollout"
import { isUsMarket } from "@/lib/market-config"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"

export async function BuyerHeroBlock() {
  const [t, featuredShops, requestHeaders, checkoutCountryCount] = await Promise.all([
    getTranslations("home.hero"),
    loadFeaturedShopsCached(6),
    headers(),
    resolveLiveCheckoutCountryCount(),
  ])
  const usMarket = isUsMarket()
  const visitorCountry = resolveVisitorCountryIso2(requestHeaders)
  const checkoutAvailable = visitorCountry ? await isStripeCheckoutCountryResolved(visitorCountry) : true
  const graduatedCheckout =
    visitorCountry && checkoutAvailable
      ? await isGraduatedCheckoutCountryResolved(visitorCountry)
      : false
  const rolloutOnly =
    visitorCountry && checkoutAvailable && !graduatedCheckout
      ? await isRolloutOnlyCheckoutCountryResolved(visitorCountry)
      : false
  const explorerHref =
    graduatedCheckout && visitorCountry
      ? marketplaceCatalogHref("/", { shipsTo: visitorCountry })
      : "/#explorer"

  return (
    <section className={`${homeHeroShell} w-full min-w-0 max-w-full px-3 py-5 sm:px-6 sm:py-7 md:px-10 md:py-16`}>
      <HeroGradientBg />
      <div className="relative mx-auto w-full min-w-0 max-w-4xl text-center">
        <h1 className="text-balance text-[1.35rem] font-bold leading-tight tracking-tight sm:text-2xl md:text-5xl lg:text-6xl">
          {t("title")}{" "}
          <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-shift_6s_ease_infinite]">
            {t("titleHighlight")}
          </span>
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-pretty text-xs leading-relaxed text-violet-100/95 sm:mt-4 sm:text-base">
          {usMarket ? t("subUs", { count: checkoutCountryCount }) : t("sub", { count: checkoutCountryCount })}
        </p>
        {!checkoutAvailable && visitorCountry ? (
          <CheckoutRegionComingSoonBanner
            className="mx-auto mt-4 max-w-2xl text-left sm:mt-5"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable={false}
          />
        ) : null}
        {graduatedCheckout && visitorCountry ? (
          <GraduatedCheckoutPermanentBanner
            className="mx-auto mt-4 max-w-2xl text-left sm:mt-5"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable
            graduatedCheckout
          />
        ) : rolloutOnly && visitorCountry ? (
          <RolloutShippingConfirmedBanner
            className="mx-auto mt-4 max-w-2xl text-left sm:mt-5"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable
            rolloutOnly
          />
        ) : null}
        <div className="mx-auto mt-4 max-w-xl sm:mt-8">
          <BuyerHeroSearch />
        </div>
        <div className="mt-4 flex flex-col items-center gap-2.5 sm:mt-8 sm:gap-4">
          <GlowCtaLink href={explorerHref}>{t("ctaPrimary")}</GlowCtaLink>
          <FastLink
            href="/creators"
            localeAware
            className="text-sm font-medium text-violet-100/90 underline-offset-4 transition hover:text-white hover:underline"
          >
            {t("creatorLink")}
          </FastLink>
        </div>
        <HomeBuyerSmartStrip featuredShops={featuredShops} />
      </div>
    </section>
  )
}
