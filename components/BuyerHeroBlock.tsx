import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { headers } from "next/headers"

import { BuyerHeroSearch } from "@/components/BuyerHeroSearch"
import { CheckoutRegionComingSoonBanner } from "@/components/marketplace/checkout-region-coming-soon-banner"
import { GraduatedCheckoutPermanentBanner } from "@/components/marketplace/graduated-checkout-permanent-banner"
import { RolloutShippingConfirmedBanner } from "@/components/marketplace/rollout-shipping-confirmed-banner"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { HomeBuyerSmartStrip } from "@/components/home/HomeBuyerSmartStrip"
import { HomeBuyerSmartStripFallback } from "@/components/home/home-buyer-smart-strip-fallback"
import { homeHeroShell } from "@/components/home/home-hero-tokens"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { FastLink } from "@/components/navigation/fast-link"
import { RotatingSloganPro } from "@/components/ui/RotatingSloganPro"
import {
  isGraduatedCheckoutCountryResolved,
  isRolloutOnlyCheckoutCountryResolved,
  isStripeCheckoutCountryResolved,
  resolveLiveCheckoutCountryCount,
} from "@/lib/checkout-country-rollout"
import { isUsMarket } from "@/lib/market-config"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"

const BECOME_RESELLER_HREF = "/become-reseller" as const

export async function BuyerHeroBlock() {
  const [t, tSlogan, requestHeaders, checkoutCountryCount] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("slogans.buyer"),
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
  const buyerPhrases = tSlogan.raw("rotatifs") as string[]

  return (
    <section
      className={`${homeHeroShell} w-full min-w-0 max-w-full px-3 py-2 max-md:max-h-[280px] max-md:overflow-hidden sm:px-6 sm:py-7 md:max-h-none md:overflow-visible md:px-10 md:py-16`}
    >
      <HeroGradientBg />
      <div className="relative mx-auto w-full min-w-0 max-w-4xl text-center">
        <RotatingSloganPro
          persona="buyer"
          tone="dark"
          base={tSlogan("base")}
          phrases={buyerPhrases}
          canonical={tSlogan("canonical")}
          className="min-h-[5.5rem] text-balance text-center text-[1.65rem] leading-[0.9] sm:min-h-0 sm:text-4xl md:text-6xl lg:text-7xl"
        />
        <p className="mx-auto mt-1 max-w-2xl text-pretty text-[10px] leading-snug text-violet-100/90 sm:mt-4 sm:text-base sm:leading-relaxed">
          {usMarket ? t("subUs", { count: checkoutCountryCount }) : t("sub", { count: checkoutCountryCount })}
        </p>
        {!checkoutAvailable && visitorCountry ? (
          <CheckoutRegionComingSoonBanner
            className="mx-auto mt-2 hidden max-w-2xl text-left sm:mt-5 sm:block"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable={false}
          />
        ) : null}
        {graduatedCheckout && visitorCountry ? (
          <GraduatedCheckoutPermanentBanner
            className="mx-auto mt-2 hidden max-w-2xl text-left sm:mt-5 sm:block"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable
            graduatedCheckout
          />
        ) : rolloutOnly && visitorCountry ? (
          <RolloutShippingConfirmedBanner
            className="mx-auto mt-2 hidden max-w-2xl text-left sm:mt-5 sm:block"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable
            rolloutOnly
          />
        ) : null}
        <div className="mx-auto mt-2 max-w-xl sm:mt-8">
          <BuyerHeroSearch />
        </div>
        <div className="mt-2 hidden flex-col items-center gap-2 sm:mt-8 sm:flex sm:gap-4">
          <GlowCtaLink href={explorerHref}>{t("ctaPrimary")}</GlowCtaLink>
          <FastLink
            href={BECOME_RESELLER_HREF}
            localeAware
            className="text-xs font-medium text-violet-100/90 underline-offset-4 transition hover:text-white hover:underline sm:text-sm"
          >
            {t("creatorLink")}
          </FastLink>
        </div>
        <div className="hidden md:block">
          <Suspense fallback={<HomeBuyerSmartStripFallback />}>
            <HomeBuyerSmartStrip />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
