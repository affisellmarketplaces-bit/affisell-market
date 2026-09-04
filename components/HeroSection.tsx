"use client"

import { motion } from "framer-motion"
import { Check, Shield } from "lucide-react"
import { useTranslations } from "next-intl"

import { BuyerHeroSearch } from "@/components/BuyerHeroSearch"
import { fadeSlideUp, motionTransition } from "@/lib/motion-presets"
import { BUYER_PREMIUM_TRUST_PILLS } from "@/lib/buyer-premium-home-content"
import { cn } from "@/lib/utils"

type Variant = "buyer" | "creators" | "partners"

type Props = {
  variant: Variant
  className?: string
}

function BuyerPremiumHero() {
  const t = useTranslations("home.hero")

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-violet-300/30 px-4 py-10 sm:px-8 sm:py-14 md:py-16",
        "bg-gradient-to-br from-[#ddd6fe] via-[#c4b5fd] to-[#a5b4fc]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute left-1/2 top-8 h-40 w-[80%] -translate-x-1/2 rounded-full bg-white/25 blur-2xl" />
      </div>

      <motion.div
        className="relative mx-auto max-w-3xl text-center"
        variants={fadeSlideUp}
        initial="hidden"
        animate="visible"
        transition={motionTransition}
      >
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md">
          <Shield className="size-3.5 text-indigo-600" aria-hidden />
          {t("badge")}
        </div>

        <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-[2.65rem] md:leading-[1.12]">
          {t("titlePremium")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-700 sm:text-base">
          {t("subPremium")}
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <BuyerHeroSearch premium />
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {BUYER_PREMIUM_TRUST_PILLS.map((label) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm"
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  )
}

export function HeroSection({ variant, className }: Props) {
  const ns = variant === "buyer" ? "home.hero" : `${variant}.hero`
  const t = useTranslations(ns)

  if (variant === "buyer") {
    return (
      <div className={className}>
        <BuyerPremiumHero />
      </div>
    )
  }

  const gradient =
    variant === "partners"
      ? "from-sky-900 via-indigo-900 to-violet-950"
      : "from-violet-700 via-indigo-800 to-sky-900"

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br px-6 py-12 text-white shadow-xl sm:px-10 sm:py-16",
        gradient,
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
        <motion.div
          className="absolute -left-1/4 h-full w-2/3 rounded-full bg-violet-400/30 blur-[80px]"
          animate={{ x: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <motion.div
        className="relative mx-auto max-w-3xl text-center"
        variants={fadeSlideUp}
        initial="hidden"
        animate="visible"
        transition={motionTransition}
      >
        <h1 className="text-4xl font-black tracking-tighter leading-[0.95] sm:text-5xl md:text-6xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-violet-100/95 sm:text-base">{t("sub")}</p>
        <div className="mt-8">
          <a
            href={
              variant === "creators"
                ? "/signup/affiliate?role=creator"
                : "/signup/supplier?role=supplier"
            }
            className="inline-flex rounded-2xl bg-[#6366F1] px-8 py-3.5 text-base font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-[#5558E3] hover:shadow-xl"
          >
            {t("cta")}
          </a>
        </div>
      </motion.div>
    </section>
  )
}

export function HeroBuyerExtras({
  searchSlot,
  ctaSlot,
  linkSlot,
}: {
  searchSlot: React.ReactNode
  ctaSlot: React.ReactNode
  linkSlot: React.ReactNode
}) {
  return (
    <div className="relative mx-auto mt-8 max-w-xl space-y-6">
      {searchSlot}
      <div className="flex flex-col items-center gap-4">
        {ctaSlot}
        {linkSlot}
      </div>
    </div>
  )
}

export function HeroCreatorBadges() {
  const t = useTranslations("creators.hero")
  const badges = [t("badgeCreators"), t("badgeRevenue"), t("badgeSetup")]
  return (
    <ul className="relative mt-10 flex flex-wrap justify-center gap-3 text-sm font-semibold">
      {badges.map((label) => (
        <li key={label} className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">
          {label}
        </li>
      ))}
    </ul>
  )
}

export function HeroPartnerBadges() {
  return null
}
