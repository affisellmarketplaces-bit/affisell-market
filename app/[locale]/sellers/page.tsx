import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { BarChart3, Package, Wallet } from "lucide-react"

import { GlowCtaLink } from "@/components/GlowCtaLink"
import { PersonaLandingHero } from "@/components/marketing/PersonaLandingHero"
import { SellerMarginExampleCard } from "@/components/marketing/seller-margin-example-card"
import { SellerPayoutSplitCard } from "@/components/marketing/seller-payout-split-card"
import { BentoCard } from "@/components/marketing/bento-card"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { Link } from "@/i18n/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "sellers.meta" })
  return { title: t("title"), description: t("description") }
}

export default async function SellersLocalePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("sellers")
  const steps = [t("steps.step1"), t("steps.step2"), t("steps.step3"), t("steps.step4"), t("steps.step5")]

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <PersonaLandingHero
        persona="sellers"
        ctaHref="/signup/affiliate?role=seller"
        footerHref="/creators"
        footerKey="footerLink"
      />
      <SellerMarginExampleCard />
      <SellerPayoutSplitCard />
      <section>
        <h2 className="text-center text-xl font-semibold">{t("steps.title")}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((label, i) => (
            <li
              key={label}
              className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-zinc-950"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366F1] text-lg font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{label}</p>
            </li>
          ))}
        </ol>
      </section>
      <StaggerIn className="grid gap-4 md:grid-cols-3">
        <StaggerItem>
          <BentoCard title={t("features.products.title")} description={t("features.products.description")}>
            <Package className="h-8 w-8 text-[#6366F1]" aria-hidden />
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard title={t("features.finance.title")} description={t("features.finance.description")}>
            <Wallet className="h-8 w-8 text-[#6366F1]" aria-hidden />
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard title={t("features.analytics.title")} description={t("features.analytics.description")}>
            <BarChart3 className="h-8 w-8 text-[#6366F1]" aria-hidden />
          </BentoCard>
        </StaggerItem>
      </StaggerIn>
      <div className="text-center">
        <GlowCtaLink href="/signup/affiliate?role=seller">{t("ctaFinal")}</GlowCtaLink>
        <p className="mt-6">
          <Link href="/creators" className="text-sm text-zinc-500 hover:text-[#6366F1]">
            {t("footerLink")}
          </Link>
        </p>
      </div>
    </main>
  )
}
