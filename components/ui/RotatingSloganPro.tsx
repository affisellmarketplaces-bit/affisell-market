"use client"

import { useEffect, useState } from "react"

import {
  longestSloganPhrase,
  resolveSloganCopy,
  SLOGAN_SYSTEM,
  type SloganPersona,
} from "@/lib/slogans/rotating-system"
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

/**
 * Master rotating slogan — SSR always shows rotatifs[0] (SEO-safe).
 * Client rotation starts only after hydration + reduced-motion / visibility checks.
 * DOM kept lean (≤6 nodes under h1) for mobile LCP / node budget.
 */
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
  const [hydrated, setHydrated] = useState(false)
  const [paused, setPaused] = useState(false)
  const phrase = copy.rotatifs[index] ?? copy.rotatifs[0] ?? ""
  const sizer = longestSloganPhrase(copy.rotatifs)
  const resolvedTone = tone ?? (cfg.textTone === "light" ? "dark" : "light")
  const gradient = resolvedTone === "dark" ? cfg.colorOnDark : cfg.color

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let timer: number | null = null

    const start = () => {
      if (timer != null) window.clearInterval(timer)
      if (document.hidden || paused) return
      timer = window.setInterval(() => {
        setIndex((n) => (n + 1) % copy.rotatifs.length)
      }, copy.interval)
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (timer != null) window.clearInterval(timer)
        timer = null
      } else {
        start()
      }
    }

    start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      if (timer != null) window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [hydrated, paused, copy.interval, copy.rotatifs.length])

  const titleClass =
    resolvedTone === "dark" ? "text-white" : "text-zinc-950 dark:text-white"

  const suffixClass =
    resolvedTone === "dark" ? "text-white/75" : "text-zinc-500 dark:text-zinc-400"

  const pulseClass =
    persona === "supplier"
      ? "bg-emerald-400"
      : persona === "reseller"
        ? "bg-fuchsia-300"
        : "bg-sky-300"

  const phraseClass = cn(
    "whitespace-nowrap bg-gradient-to-r bg-clip-text text-transparent",
    hydrated && "animate-[fadeBlur_0.6s_ease]",
    gradient
  )

  return (
    <h1
      className={cn(
        "font-black tracking-[-0.03em] leading-[0.9]",
        "text-4xl md:text-6xl lg:text-7xl",
        titleClass,
        className
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="sr-only">{copy.canonical}</span>

      {persona === "buyer" ? (
        <>
          <span aria-hidden className="block">
            {copy.base}
          </span>
          <span
            aria-hidden
            className="relative mt-2 inline-grid min-h-[1.1em] items-baseline justify-items-center md:mt-3"
          >
            <span className="invisible col-start-1 row-start-1 whitespace-nowrap">{sizer}</span>
            <span
              key={phrase}
              className={cn("col-start-1 row-start-1", phraseClass)}
              aria-live="polite"
              aria-atomic="true"
            >
              {phrase}
            </span>
          </span>
        </>
      ) : (
        <span aria-hidden className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>{copy.base}</span>
          <span className="relative inline-grid min-h-[1.1em] items-baseline">
            <span className="invisible col-start-1 row-start-1 whitespace-nowrap">{sizer}</span>
            <span className={cn("col-start-1 row-start-1 inline-flex items-baseline gap-2")}>
              <span key={phrase} className={phraseClass} aria-live="polite" aria-atomic="true">
                {phrase}
              </span>
              <span
                className={cn("size-1.5 shrink-0 animate-pulse rounded-full md:size-2", pulseClass)}
                aria-hidden
              />
            </span>
          </span>
        </span>
      )}

      {copy.fixedSuffix ? (
        <span
          aria-hidden
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
