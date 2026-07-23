import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { GlowCtaButton } from "@/components/marketing/glow-cta-button"
import { BuyerHeroSearch } from "@/components/home/buyer-hero-search"
import { RotatingSloganPro } from "@/components/ui/RotatingSloganPro"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

const BECOME_RESELLER_HREF = "/become-reseller" as const

export async function BuyerHeroSection() {
  const [t, tSlogan] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("slogans.buyer"),
  ])
  const phrases = tSlogan.raw("rotatifs") as string[]

  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-700 via-indigo-800 to-sky-900 px-4 py-12 text-white shadow-xl sm:px-10 sm:py-16">
      <HeroGradientBg />
      <div className="relative mx-auto max-w-4xl text-center">
        <RotatingSloganPro
          persona="buyer"
          tone="dark"
          base={tSlogan("base")}
          phrases={phrases}
          canonical={tSlogan("canonical")}
          className="text-balance text-center"
        />
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
            href={BECOME_RESELLER_HREF}
            className="text-sm font-medium text-violet-100/90 underline-offset-4 transition hover:text-white hover:underline"
          >
            {t("creatorLink")}
          </Link>
        </div>
      </div>
    </section>
  )
}
