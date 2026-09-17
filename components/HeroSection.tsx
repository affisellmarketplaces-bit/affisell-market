"use client"

import { motion } from "framer-motion"
import { Check, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { BuyerHeroSearch } from "@/components/BuyerHeroSearch"
import { RotatingSloganPro } from "@/components/ui/RotatingSloganPro"
import { fadeSlideUp, motionTransition } from "@/lib/motion-presets"
import { BUYER_PREMIUM_TRUST_PILLS } from "@/lib/buyer-premium-home-content"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"
import { cn } from "@/lib/utils"

type Variant = "buyer" | "creators" | "partners"

type Props = {
  variant: Variant
  className?: string
}

function BuyerPremiumHero() {
  const t = useTranslations("home.hero")
  const tSlogan = useTranslations("slogans.buyer")
  const rotatifs = tSlogan.raw("rotatifs") as string[]

  return (
    <section
      className={cn(
        "relative overflow-visible px-1 pb-10 pt-6 sm:px-2 sm:pb-12 sm:pt-8 md:pb-14 md:pt-10"
      )}
      data-testid="buyer-premium-hero"
    >
      <motion.div
        className="relative mx-auto max-w-3xl text-center"
        variants={fadeSlideUp}
        initial={false}
        animate="visible"
        transition={motionTransition}
      >
        <div
          className="mb-5 inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold shadow-sm backdrop-blur-md"
          style={{
            backgroundColor: BUYER_PREMIUM.badge.heroBg,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: BUYER_PREMIUM.badge.heroBorder,
            color: BUYER_PREMIUM.badge.heroText,
          }}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm shadow-violet-600/40">
            <ShieldCheck className="size-3 text-white" strokeWidth={2.5} aria-hidden />
          </span>
          {t("badgeLabel")}
        </div>

        <RotatingSloganPro
          persona="buyer"
          base={t("titlePremium")}
          phrases={rotatifs}
          fixedSuffix={null}
          canonical={`${t("titlePremium")} ${rotatifs[0] ?? ""}`}
          className="text-balance text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl md:text-[2.65rem] lg:text-[2.65rem]"
        />
        <p
          data-testid="buyer-hero-subtitle"
          className="mx-auto mt-4 max-w-2xl text-pretty text-sm font-medium leading-relaxed tracking-[0.01em] sm:text-base sm:leading-7"
          style={{
            color: BUYER_PREMIUM.hero.subline,
            textShadow: BUYER_PREMIUM.hero.sublineShadow,
          }}
        >
          {t("subPremium")}
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <BuyerHeroSearch premium />
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {BUYER_PREMIUM_TRUST_PILLS.map((label) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: BUYER_PREMIUM.trust.pillBorder,
                color: BUYER_PREMIUM.trust.pillText,
              }}
            >
              <span
                className="flex size-4 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: BUYER_PREMIUM.trust.check }}
              >
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
