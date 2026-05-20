"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Globe, Package, SlidersHorizontal } from "lucide-react"

import { FeatureCard } from "@/components/marketing/feature-card"
import { GlowCtaButton } from "@/components/marketing/glow-cta-button"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { fadeSlideUp, motionTransition } from "@/lib/motion-presets"

export function PartnersLanding() {
  const t = useTranslations("partners")

  const steps = [t("steps.step1"), t("steps.step2"), t("steps.step3")]

  return (
    <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-900 via-indigo-900 to-violet-950 px-6 py-14 text-white sm:px-12">
        <HeroGradientBg />
        <motion.div
          className="relative mx-auto max-w-3xl text-center"
          variants={fadeSlideUp}
          initial="hidden"
          animate="visible"
          transition={motionTransition}
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("hero.title")}</h1>
          <p className="mt-4 text-sky-100/90">{t("hero.sub")}</p>
          <div className="mt-8">
            <GlowCtaButton href="/signup/supplier">{t("hero.cta")}</GlowCtaButton>
          </div>
        </motion.div>
      </section>

      <StaggerIn className="grid gap-6 md:grid-cols-3">
        <StaggerItem>
          <FeatureCard
            title={t("features.reach.title")}
            description={t("features.reach.description")}
            icon={Globe}
          />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard
            title={t("features.automation.title")}
            description={t("features.automation.description")}
            icon={Package}
          />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard
            title={t("features.control.title")}
            description={t("features.control.description")}
            icon={SlidersHorizontal}
          />
        </StaggerItem>
      </StaggerIn>

      <section>
        <h2 className="text-center text-xl font-semibold">{t("steps.title")}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((label, i) => (
            <li
              key={label}
              className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{label}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="text-center">
        <GlowCtaButton href="/signup/supplier">{t("ctaFinal")}</GlowCtaButton>
        <p className="mt-6">
          <Link href="/creators" className="text-sm text-zinc-500 hover:text-violet-600">
            {t("backCreators")}
          </Link>
        </p>
      </div>
    </main>
  )
}
