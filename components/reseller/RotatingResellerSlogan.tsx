"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

const SLOGANS = [
  { verb: "products", outcome: "profits" },
  { verb: "ideas", outcome: "income" },
  { verb: "listings", outcome: "cash" },
  { verb: "clicks", outcome: "profit" },
  { verb: "trends", outcome: "money" },
  { verb: "catalog", outcome: "revenue" },
] as const

const CANONICAL = "Turn products into profits. Instantly."
const INTERVAL_MS = 2500
const APPLE_EASE = [0.25, 0.1, 0.25, 1] as const

const LONGEST_VERB = SLOGANS.reduce((a, s) => (s.verb.length > a.length ? s.verb : a), "")
const LONGEST_OUTCOME = SLOGANS.reduce(
  (a, s) => (s.outcome.length > a.length ? s.outcome : a),
  ""
)

export function RotatingResellerSlogan() {
  const [index, setIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const current = SLOGANS[index] ?? SLOGANS[0]

  const goNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % SLOGANS.length)
  }, [])

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + SLOGANS.length) % SLOGANS.length)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return
    const timer = window.setInterval(goNext, INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [goNext, prefersReducedMotion])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

  const slide = prefersReducedMotion
    ? {
        initial: { opacity: 1, y: 0, filter: "blur(0px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 1, y: 0, filter: "blur(0px)" },
      }
    : {
        initial: { y: 20, opacity: 0, filter: "blur(8px)" },
        animate: { y: 0, opacity: 1, filter: "blur(0px)" },
        exit: { y: -20, opacity: 0, filter: "blur(8px)" },
      }

  return (
    <h1 className="text-4xl font-bold tracking-tight leading-[1.1] md:text-6xl">
      {/* Canonical phrase always in DOM for SEO / a11y */}
      <span className="sr-only">{CANONICAL}</span>

      <span aria-hidden="true" className="block">
        <span className="inline">Turn </span>
        <span className="relative inline-grid align-baseline">
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden>
            {LONGEST_VERB}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={current.verb}
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
              transition={{ duration: 0.4, ease: APPLE_EASE }}
              className="col-start-1 row-start-1 inline-block whitespace-nowrap"
            >
              {current.verb}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="inline"> into </span>
        <span className="relative inline-grid align-baseline">
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden>
            {LONGEST_OUTCOME}.
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={current.outcome}
              initial={
                prefersReducedMotion
                  ? { opacity: 1, y: 0 }
                  : { y: 20, opacity: 0 }
              }
              animate={{ y: 0, opacity: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 1, y: 0 }
                  : { y: -20, opacity: 0 }
              }
              transition={{
                duration: 0.4,
                ease: APPLE_EASE,
                delay: prefersReducedMotion ? 0 : 0.05,
              }}
              className="col-start-1 row-start-1 inline-block whitespace-nowrap bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent"
            >
              {current.outcome}.
            </motion.span>
          </AnimatePresence>
        </span>
      </span>

      <span
        aria-hidden="true"
        className="mt-2 block text-2xl font-semibold text-zinc-500 md:text-3xl dark:text-zinc-400"
      >
        Instantly.
      </span>
    </h1>
  )
}
