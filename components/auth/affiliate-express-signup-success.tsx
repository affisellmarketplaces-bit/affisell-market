"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useTranslations } from "next-intl"
import { ArrowRight, Check, Mail, Sparkles, Store } from "lucide-react"

import { cn } from "@/lib/utils"

const AUTO_REDIRECT_MS = 3_200

type Props = {
  displayName: string
  email: string
  afterLoginPath: string
}

function fireAffiliateSignupConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    confetti({
      particleCount: 88,
      spread: 62,
      origin: { y: 0.58 },
      colors: ["#a78bfa", "#818cf8", "#34d399", "#10b981", "#f472b6"],
      disableForReducedMotion: true,
    })
    window.setTimeout(() => {
      confetti({
        particleCount: 42,
        spread: 90,
        origin: { y: 0.48, x: 0.72 },
        colors: ["#c4b5fd", "#6ee7b7", "#22d3ee"],
        disableForReducedMotion: true,
      })
    }, 200)
  })
}

function SuccessCheckmark({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      className="relative mx-auto flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28"
      initial={reducedMotion ? false : { scale: 0.55, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
      role="img"
      aria-label="Success"
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full bg-violet-400/30 blur-2xl"
        aria-hidden
      />
      <motion.span
        className="pointer-events-none absolute inset-[-10%] rounded-full border border-emerald-300/35"
        aria-hidden
        animate={reducedMotion ? undefined : { scale: [1, 1.1, 1], opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-500 shadow-[0_0_52px_-10px_rgba(167,139,250,0.9)]">
        <motion.span
          initial={reducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 340, damping: 16, delay: 0.12 }}
        >
          <Check className="h-12 w-12 text-white sm:h-14 sm:w-14" strokeWidth={3.5} aria-hidden />
        </motion.span>
      </span>
    </motion.div>
  )
}

export function AffiliateExpressSignupSuccess({ displayName, email, afterLoginPath }: Props) {
  const t = useTranslations("auth.affiliateExpress.success")
  const reducedMotion = useReducedMotion()
  const navigated = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_REDIRECT_MS / 1000))

  const go = useCallback(() => {
    if (navigated.current) return
    navigated.current = true
    window.location.assign(afterLoginPath)
  }, [afterLoginPath])

  useEffect(() => {
    if (!reducedMotion) fireAffiliateSignupConfetti()

    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    const redirect = window.setTimeout(go, AUTO_REDIRECT_MS)

    return () => {
      window.clearInterval(tick)
      window.clearTimeout(redirect)
    }
  }, [go, reducedMotion])

  const title = displayName.trim()
    ? t("titleNamed", { name: displayName.trim() })
    : t("titleFallback")

  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6 text-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
        <Sparkles className="size-3.5 text-emerald-300" aria-hidden />
        {t("badge")}
      </p>

      <SuccessCheckmark reducedMotion={Boolean(reducedMotion)} />

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-violet-100/85">{t("subtitle")}</p>
      </div>

      <div className="mx-auto max-w-sm space-y-2 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-left">
        <p className="inline-flex items-center gap-2 text-xs font-medium text-emerald-200/95">
          <Store className="size-3.5 shrink-0" aria-hidden />
          {t("storeReady")}
        </p>
        <p className="inline-flex items-center gap-2 text-xs text-violet-100/75">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          {t("emailConfirmed", { email })}
        </p>
      </div>

      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={go}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600",
            "py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110"
          )}
        >
          {t("cta")}
          <ArrowRight className="size-4" aria-hidden />
        </button>
        <p className="text-xs text-violet-200/70">
          {t("redirectHint", { seconds: secondsLeft })}
        </p>
      </div>
    </motion.div>
  )
}
