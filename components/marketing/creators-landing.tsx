"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Layers, RefreshCw, Wallet } from "lucide-react"

import { FeatureCard } from "@/components/marketing/feature-card"
import { GlowCtaButton } from "@/components/marketing/glow-cta-button"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { fadeSlideUp, motionTransition } from "@/lib/motion-presets"

export function CreatorsLanding() {
  const t = useTranslations("creators")

  return (
    <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-800 to-indigo-950 px-6 py-14 text-white sm:px-12">
        <HeroGradientBg />
        <motion.div
          className="relative mx-auto max-w-3xl text-center"
          variants={fadeSlideUp}
          initial="hidden"
          animate="visible"
          transition={motionTransition}
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("hero.title")}</h1>
          <p className="mt-4 text-violet-100/90">{t("hero.sub")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <GlowCtaButton href="/signup/affiliate">{t("hero.cta")}</GlowCtaButton>
          </div>
          <ul className="mt-10 flex flex-wrap justify-center gap-4 text-sm font-semibold">
            <li className="rounded-full bg-white/10 px-4 py-2">{t("hero.badgeCreators")}</li>
            <li className="rounded-full bg-white/10 px-4 py-2">{t("hero.badgeRevenue")}</li>
            <li className="rounded-full bg-white/10 px-4 py-2">{t("hero.badgeSetup")}</li>
          </ul>
        </motion.div>
      </section>

      <StaggerIn className="grid gap-6 md:grid-cols-3">
        <StaggerItem>
          <FeatureCard
            title={t("features.pick.title")}
            description={t("features.pick.description")}
            icon={Layers}
          />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard
            title={t("features.sync.title")}
            description={t("features.sync.description")}
            icon={RefreshCw}
          />
        </StaggerItem>
        <StaggerItem>
          <FeatureCard
            title={t("features.paid.title")}
            description={t("features.paid.description")}
            icon={Wallet}
          />
        </StaggerItem>
      </StaggerIn>

      <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-center text-xl font-semibold">{t("social.title")}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <blockquote
              key={i}
              className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {t(`social.quote${i}` as "social.quote1")}
              </p>
              <p className="mt-3 text-xs font-semibold text-violet-600">
                {t("social.revenueTag", { amount: "$2.4k" })}
              </p>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="group rounded-3xl border border-zinc-200 p-6 transition hover:shadow-xl dark:border-zinc-800">
        <h2 className="text-lg font-semibold">{t("preview.title")}</h2>
        <p className="text-sm text-zinc-500">{t("preview.hint")}</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 transition duration-300 group-hover:scale-[1.01] dark:border-zinc-700">
          <Image
            src="/illustrations/dashboard-preview.svg"
            alt=""
            width={960}
            height={480}
            className="w-full"
          />
        </div>
      </section>

      <p className="text-center">
        <Link href="/partners" className="text-sm font-medium text-violet-600 hover:underline">
          {t("footerLink")}
        </Link>
      </p>
    </main>
  )
}
