import { getTranslations } from "next-intl/server"
import { headers } from "next/headers"

import { BuyerHeroSearch } from "@/components/BuyerHeroSearch"
import { CheckoutRegionComingSoonBanner } from "@/components/marketplace/checkout-region-coming-soon-banner"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { HomeBuyerSmartStrip } from "@/components/home/HomeBuyerSmartStrip"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { Link } from "@/i18n/navigation"
import { loadFeaturedShopsCached } from "@/lib/public-home-cache"
import { isStripeCheckoutCountry } from "@/lib/eu-market-countries"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"

export async function BuyerHeroBlock() {
  const [t, featuredShops, requestHeaders] = await Promise.all([
    getTranslations("home.hero"),
    loadFeaturedShopsCached(6),
    headers(),
  ])
  const visitorCountry = resolveVisitorCountryIso2(requestHeaders)
  const checkoutAvailable = visitorCountry ? isStripeCheckoutCountry(visitorCountry) : true

  return (
    <section className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-700 via-indigo-800 to-sky-900 px-3 py-5 text-white shadow-xl sm:rounded-3xl sm:px-6 sm:py-7 md:px-10 md:py-16">
      <HeroGradientBg />
      <div className="relative mx-auto w-full min-w-0 max-w-4xl text-center">
        <h1 className="text-balance text-[1.35rem] font-bold leading-tight tracking-tight sm:text-2xl md:text-5xl lg:text-6xl">
          {t("title")}{" "}
          <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-shift_6s_ease_infinite]">
            {t("titleHighlight")}
          </span>
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-pretty text-xs leading-relaxed text-violet-100/95 sm:mt-4 sm:text-base">{t("sub")}</p>
        {!checkoutAvailable && visitorCountry ? (
          <CheckoutRegionComingSoonBanner
            className="mx-auto mt-4 max-w-2xl text-left sm:mt-5"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable={false}
          />
        ) : null}
        <div className="mx-auto mt-4 max-w-xl sm:mt-8">
          <BuyerHeroSearch />
        </div>
        <div className="mt-4 flex flex-col items-center gap-2.5 sm:mt-8 sm:gap-4">
          <GlowCtaLink href="/#explorer">{t("ctaPrimary")}</GlowCtaLink>
          <Link
            href="/creators"
            className="text-sm font-medium text-violet-100/90 underline-offset-4 transition hover:text-white hover:underline"
          >
            {t("creatorLink")}
          </Link>
        </div>
        <HomeBuyerSmartStrip featuredShops={featuredShops} />
      </div>
    </section>
  )
}
