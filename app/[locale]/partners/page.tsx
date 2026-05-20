import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Globe, Package, SlidersHorizontal } from "lucide-react"

import { FeatureCard } from "@/components/FeatureCard"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { HeroSection } from "@/components/HeroSection"
import { MarketingFooter } from "@/components/MarketingFooter"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { Link } from "@/i18n/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "partners.meta" })
  return { title: t("title"), description: t("description") }
}

export default async function PartnersPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("partners")

  const steps = [t("steps.step1"), t("steps.step2"), t("steps.step3")]

  return (
    <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
      <HeroSection variant="partners" />
      <StaggerIn className="grid gap-6 md:grid-cols-3">
        <StaggerItem>
          <FeatureCard title={t("features.reach.title")} description={t("features.reach.description")} icon={Globe} />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard title={t("features.automation.title")} description={t("features.automation.description")} icon={Package} />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard title={t("features.control.title")} description={t("features.control.description")} icon={SlidersHorizontal} />
        </StaggerItem>
      </StaggerIn>
      <section>
        <h2 className="text-center text-xl font-semibold">{t("steps.title")}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((label, i) => (
            <li key={label} className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-zinc-950">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366F1] text-lg font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{label}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="text-center">
        <GlowCtaLink href="/signup/supplier?role=supplier">{t("ctaFinal")}</GlowCtaLink>
        <p className="mt-6">
          <Link href="/creators" className="text-sm text-zinc-500 hover:text-[#6366F1]">
            {t("backCreators")}
          </Link>
        </p>
      </div>
      <MarketingFooter />
    </main>
  )
}
