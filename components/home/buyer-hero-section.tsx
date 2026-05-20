import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { GlowCtaButton } from "@/components/marketing/glow-cta-button"
import { BuyerHeroSearch } from "@/components/home/buyer-hero-search"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

export async function BuyerHeroSection() {
  const t = await getTranslations("home.hero")

  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-700 via-indigo-800 to-sky-900 px-4 py-12 text-white shadow-xl sm:px-10 sm:py-16">
      <HeroGradientBg />
      <div className="relative mx-auto max-w-4xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          {t("title")}{" "}
          <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-shift_6s_ease_infinite]">
            {t("titleHighlight")}
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-violet-100/95 sm:text-base">
          {t("sub")}
        </p>
        <div className="mx-auto mt-8 max-w-xl">
          <BuyerHeroSearch />
        </div>
        <div className="mt-8 flex flex-col items-center gap-4">
          <GlowCtaButton href={PUBLIC_MARKETPLACE_BROWSE_PATH}>
            {t("ctaPrimary")}
          </GlowCtaButton>
          <Link
            href="/creators"
            className="text-sm font-medium text-violet-100/90 underline-offset-4 transition hover:text-white hover:underline"
          >
            {t("creatorLink")}
          </Link>
        </div>
      </div>
    </section>
  )
}
