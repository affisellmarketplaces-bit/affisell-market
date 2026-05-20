import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Layers, RefreshCw, Wallet } from "lucide-react"

import { FeatureCard } from "@/components/FeatureCard"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { PersonaLandingHero } from "@/components/marketing/PersonaLandingHero"
import { TestimonialCarousel } from "@/components/TestimonialCarousel"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { BentoCard } from "@/components/marketing/bento-card"

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
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <PersonaLandingHero
        persona="creators"
        ctaHref="/signup/affiliate?role=creator"
        footerHref="/partners"
        footerKey="footerLink"
      />
      <StaggerIn className="grid gap-4 md:grid-cols-3">
        <StaggerItem>
          <BentoCard title={t("features.pick.title")} description={t("features.pick.description")}>
            <Layers className="h-8 w-8 text-[#6366F1]" aria-hidden />
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard title={t("features.sync.title")} description={t("features.sync.description")}>
            <RefreshCw className="h-8 w-8 text-[#6366F1]" aria-hidden />
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard title={t("features.paid.title")} description={t("features.paid.description")}>
            <Wallet className="h-8 w-8 text-[#6366F1]" aria-hidden />
          </BentoCard>
        </StaggerItem>
      </StaggerIn>
      <section className="rounded-3xl border border-gray-100 p-6 dark:border-gray-800">
        <h2 className="text-center text-xl font-semibold">{t("social.title")}</h2>
        <div className="mt-8">
          <TestimonialCarousel />
        </div>
      </section>
      <div className="text-center">
        <GlowCtaLink href="/signup/affiliate?role=creator">{t("ctaFinal")}</GlowCtaLink>
      </div>
    </main>
  )
}
