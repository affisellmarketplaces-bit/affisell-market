"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"

import NextLink from "next/link"
import { fadeSlideUp, motionTransition } from "@/lib/motion-presets"
import { cn } from "@/lib/utils"

type Variant = "buyer" | "creators" | "partners"

type Props = {
  variant: Variant
  className?: string
}

export function HeroSection({ variant, className }: Props) {
  const ns = variant === "buyer" ? "home.hero" : `${variant}.hero`
  const t = useTranslations(ns)

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
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          {variant === "buyer" ? (
            <>
              {t("title")}{" "}
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-shift_6s_ease_infinite]">
                {t("titleHighlight")}
              </span>
            </>
          ) : (
            t("title")
          )}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-violet-100/95 sm:text-base">{t("sub")}</p>
        {variant !== "buyer" ? (
          <div className="mt-8">
            <NextLink
              href={
                variant === "creators"
                  ? "/signup/affiliate?role=creator"
                  : "/signup/supplier?role=supplier"
              }
              className="inline-flex rounded-2xl bg-[#6366F1] px-8 py-3.5 text-base font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-[#5558E3] hover:shadow-xl"
            >
              {t("cta")}
            </NextLink>
          </div>
        ) : null}
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
