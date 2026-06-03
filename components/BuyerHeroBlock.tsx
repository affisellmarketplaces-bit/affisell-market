import { getTranslations } from "next-intl/server"

import { BuyerHeroSearch } from "@/components/BuyerHeroSearch"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { HomeBuyerSmartStrip } from "@/components/home/HomeBuyerSmartStrip"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { Link } from "@/i18n/navigation"
import { loadFeaturedShopsCached } from "@/lib/public-home-cache"

export async function BuyerHeroBlock() {
  const [t, featuredShops] = await Promise.all([
    getTranslations("home.hero"),
    loadFeaturedShopsCached(6),
  ])

  return (
    <section className="relative w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-700 via-indigo-800 to-sky-900 px-4 py-7 text-white shadow-xl sm:px-10 sm:py-16">
      <HeroGradientBg />
      <div className="relative mx-auto w-full min-w-0 max-w-4xl text-center">
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          {t("title")}{" "}
          <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-shift_6s_ease_infinite]">
            {t("titleHighlight")}
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-violet-100/95 sm:mt-4 sm:text-base">{t("sub")}</p>
        <div className="mx-auto mt-6 hidden max-w-xl sm:mt-8 sm:block">
          <BuyerHeroSearch />
        </div>
        <div className="mt-5 flex flex-col items-center gap-3 sm:mt-8 sm:gap-4">
          <GlowCtaLink href="/#explorer">{t("ctaPrimary")}</GlowCtaLink>
          <Link
            href="/creators"
            className="text-sm font-medium text-violet-100/90 underline-offset-4 transition hover:text-white hover:underline"
          >
            {t("creatorLink")}
          </Link>
        </div>
        <div className="hidden sm:block">
          <HomeBuyerSmartStrip featuredShops={featuredShops} />
        </div>
      </div>
    </section>
  )
}
