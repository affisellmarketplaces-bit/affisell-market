import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import Image from "next/image"
import { Layers, RefreshCw, Wallet } from "lucide-react"

import { FeatureCard } from "@/components/FeatureCard"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { HeroSection, HeroCreatorBadges } from "@/components/HeroSection"
import { MarketingFooter } from "@/components/MarketingFooter"
import { TestimonialCarousel } from "@/components/TestimonialCarousel"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { Link } from "@/i18n/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "creators.meta" })
  return { title: t("title"), description: t("description") }
}

export default async function CreatorsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("creators")

  return (
    <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <HeroSection variant="creators" />
        <HeroCreatorBadges />
      </div>
      <StaggerIn className="grid gap-6 md:grid-cols-3">
        <StaggerItem>
          <FeatureCard title={t("features.pick.title")} description={t("features.pick.description")} icon={Layers} />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard title={t("features.sync.title")} description={t("features.sync.description")} icon={RefreshCw} />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard title={t("features.paid.title")} description={t("features.paid.description")} icon={Wallet} />
        </StaggerItem>
      </StaggerIn>
      <section>
        <h2 className="text-center text-xl font-semibold">{t("social.title")}</h2>
        <div className="mt-8">
          <TestimonialCarousel />
        </div>
      </section>
      <section className="group rounded-3xl border border-gray-100 p-6 transition hover:shadow-xl dark:border-gray-800">
        <h2 className="text-lg font-semibold">{t("preview.title")}</h2>
        <p className="text-sm text-zinc-500">{t("preview.hint")}</p>
        <div className="mt-4 overflow-hidden rounded-2xl border transition duration-300 group-hover:scale-[1.01] dark:border-gray-800">
          <Image src="/illustrations/dashboard-preview.svg" alt="" width={960} height={480} className="w-full" />
        </div>
      </section>
      <div className="text-center">
        <GlowCtaLink href="/signup/affiliate?role=creator">{t("ctaFinal")}</GlowCtaLink>
        <p className="mt-6">
          <Link href="/partners" className="text-sm font-medium text-[#6366F1] hover:underline">
            {t("footerLink")}
          </Link>
        </p>
      </div>
      <MarketingFooter />
    </main>
  )
}
