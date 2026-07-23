"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import {
  longestSloganPhrase,
  resolveSloganCopy,
  SLOGAN_SYSTEM,
  type SloganPersona,
} from "@/lib/slogans/rotating-system"
import { motionEaseOut } from "@/lib/motion-presets"
import { cn } from "@/lib/utils"

type Props = {
  persona: SloganPersona
  /** Locale overrides (from messages/*.json). */
  base?: string
  phrases?: readonly string[]
  fixedSuffix?: string | null
  canonical?: string
  className?: string
  /** Dark hero (buyer home) → light gradient text. */
  tone?: "light" | "dark"
}

const enter = { y: 20, opacity: 0, filter: "blur(8px)", rotateX: -15 }
const center = { y: 0, opacity: 1, filter: "blur(0px)", rotateX: 0 }
const exit = { y: -20, opacity: 0, filter: "blur(8px)", rotateX: 15 }

export function RotatingSloganPro({
  persona,
  base: baseOverride,
  phrases,
  fixedSuffix: suffixOverride,
  canonical: canonicalOverride,
  className,
  tone,
}: Props) {
  const cfg = SLOGAN_SYSTEM[persona]
  const copy = resolveSloganCopy(persona, {
    base: baseOverride,
    rotatifs: phrases,
    fixedSuffix: suffixOverride,
    canonical: canonicalOverride,
  })
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [tabHidden, setTabHidden] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const phrase = copy.rotatifs[index] ?? copy.rotatifs[0] ?? ""
  const sizer = longestSloganPhrase(copy.rotatifs)
  const resolvedTone = tone ?? (cfg.textTone === "light" ? "dark" : "light")
  const gradient =
    resolvedTone === "dark" ? cfg.colorOnDark : cfg.color

  const goNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % copy.rotatifs.length)
  }, [copy.rotatifs.length])

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + copy.rotatifs.length) % copy.rotatifs.length)
  }, [copy.rotatifs.length])

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden)
    onVisibility()
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion || paused || tabHidden) return
    const timer = window.setInterval(goNext, copy.interval)
    return () => window.clearInterval(timer)
  }, [goNext, copy.interval, prefersReducedMotion, paused, tabHidden])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goNext()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        goPrev()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goNext, goPrev])

  const motionProps = prefersReducedMotion
    ? {
        initial: { opacity: 0.4 },
        animate: { opacity: 1 },
        exit: { opacity: 0.4 },
        transition: { duration: 0.45, ease: "easeInOut" as const },
      }
    : {
        initial: enter,
        animate: center,
        exit,
        transition: { duration: 0.6, ease: motionEaseOut },
      }

  const titleClass =
    resolvedTone === "dark"
      ? "text-white"
      : "text-zinc-950 dark:text-white"

  const suffixClass =
    resolvedTone === "dark"
      ? "text-white/75"
      : "text-zinc-500 dark:text-zinc-400"

  const pulseClass =
    persona === "supplier"
      ? "bg-emerald-400"
      : persona === "reseller"
        ? "bg-fuchsia-300"
        : "bg-sky-300"

  const phraseMotion =
    persona === "buyer" && !prefersReducedMotion
      ? {
          initial: { y: 6, opacity: 0, filter: "blur(4px)" },
          animate: { y: 0, opacity: 1, filter: "blur(0px)" },
          exit: { y: -6, opacity: 0, filter: "blur(4px)" },
          transition: { duration: 0.45, ease: motionEaseOut },
        }
      : motionProps

  const rotatingSlot = (
    <span className="relative inline-grid align-baseline">
      <span
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
        aria-hidden
      >
        {sizer}
      </span>
      <span
        className={cn(
          "col-start-1 row-start-1 inline-flex items-baseline gap-2",
          persona === "buyer" ? "justify-center" : "justify-start"
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={phrase}
            {...phraseMotion}
            className="relative inline-block origin-center whitespace-nowrap"
          >
            <span
              className={cn(
                "bg-gradient-to-r bg-clip-text text-transparent",
                resolvedTone === "dark" && "bg-[length:200%_auto]",
                gradient
              )}
            >
              {phrase}
            </span>
            {!prefersReducedMotion ? (
              <motion.span
                className={cn(
                  "absolute -bottom-1 left-0 h-0.5 w-full origin-left rounded-full bg-gradient-to-r md:-bottom-2",
                  gradient
                )}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: persona === "buyer" ? 0.8 : 0.55,
                  ease: persona === "buyer" ? ([0.16, 1, 0.3, 1] as const) : motionEaseOut,
                  delay: 0.08,
                }}
                aria-hidden
              />
            ) : null}
          </motion.span>
        </AnimatePresence>
        <span
          className={cn("size-1.5 shrink-0 animate-pulse rounded-full md:size-2", pulseClass)}
          aria-hidden
        />
      </span>
    </span>
  )

  return (
    <h1
      className={cn(
        "font-black tracking-[-0.04em] leading-[0.9]",
        persona === "buyer"
          ? "text-4xl md:text-6xl lg:text-7xl"
          : "text-4xl tracking-tighter md:text-6xl lg:text-7xl",
        titleClass,
        className
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="sr-only">{copy.canonical}</span>

      {persona === "buyer" ? (
        <>
          <span aria-hidden="true" className="block">
            {copy.base}
          </span>
          <span aria-hidden="true" className="relative mt-2 block md:mt-3">
            {rotatingSlot}
          </span>
        </>
      ) : (
        <span aria-hidden="true" className="block">
          <span className="inline">{copy.base}</span> {rotatingSlot}
        </span>
      )}

      {copy.fixedSuffix ? (
        <span
          aria-hidden="true"
          className={cn(
            "mt-2 block text-2xl font-semibold tracking-tight md:text-3xl",
            suffixClass
          )}
        >
          {copy.fixedSuffix}
        </span>
      ) : null}
    </h1>
  )
}
