import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Globe2, Headphones, Layers, ShieldCheck, Store } from "lucide-react"

import { EnterpriseBrandApplicationForm } from "@/components/enterprise/enterprise-brand-application-form"
import { GlowCtaLink } from "@/components/GlowCtaLink"
import { BentoCard } from "@/components/marketing/bento-card"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { Link } from "@/i18n/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "enterprise.meta" })
  return { title: t("title"), description: t("description") }
}

export default async function EnterprisePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("enterprise")

  const badges = [t("hero.badge1"), t("hero.badge2"), t("hero.badge3")]
  const steps = [t("steps.step1"), t("steps.step2"), t("steps.step3")]

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-zinc-900 via-violet-950 to-indigo-950 px-4 py-12 text-white shadow-xl sm:px-10 sm:py-16">
        <HeroGradientBg />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-violet-100/95 sm:text-base">{t("hero.sub")}</p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {badges.map((badge) => (
              <li
                key={badge}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"
              >
                {badge}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <GlowCtaLink href="#apply">{t("hero.cta")}</GlowCtaLink>
          </div>
        </div>
      </section>

      <StaggerIn className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <BentoCard title={t("features.catalog.title")} description={t("features.catalog.description")}>
            <Layers className="size-8 text-violet-500" aria-hidden />
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard title={t("features.brand.title")} description={t("features.brand.description")}>
            <Store className="size-8 text-violet-500" aria-hidden />
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard title={t("features.trust.title")} description={t("features.trust.description")}>
            <ShieldCheck className="size-8 text-violet-500" aria-hidden />
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard title={t("features.global.title")} description={t("features.global.description")}>
            <Globe2 className="size-8 text-violet-500" aria-hidden />
          </BentoCard>
        </StaggerItem>
      </StaggerIn>

      <section className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
            <Headphones className="size-5" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider">{t("program.eyebrow")}</p>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t("program.title")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("program.body")}</p>
          <ol className="mt-6 space-y-4">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="pt-1 text-sm text-zinc-700 dark:text-zinc-300">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            {t("program.smbHint")}{" "}
            <Link href="/partners" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
              {t("program.smbLink")}
            </Link>
          </p>
        </div>
        <EnterpriseBrandApplicationForm />
      </section>
    </main>
  )
}
