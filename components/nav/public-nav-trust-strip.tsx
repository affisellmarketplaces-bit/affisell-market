"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { FastLink } from "@/components/navigation/fast-link"

const DISMISS_KEY = "affisell_trust_strip_dismissed"

type Props = {
  visible: boolean
}

export function PublicNavTrustStrip({ visible }: Props) {
  const t = useTranslations("PublicNav")
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!visible || dismissed) return null

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div className="border-t border-violet-200/50 bg-gradient-to-r from-violet-50/95 via-white/90 to-cyan-50/90 px-2 py-1.5 dark:border-violet-900/40 dark:from-violet-950/40 dark:via-zinc-950/80 dark:to-cyan-950/30 sm:px-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 text-xs">
        <p className="flex min-w-0 items-center gap-1.5 font-medium text-violet-950 dark:text-violet-100">
          <ShieldCheck className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <span className="truncate">{t("trustStripText")}</span>
          <FastLink
            href="/protected-checkout"
            className="hidden shrink-0 font-semibold text-violet-700 underline-offset-2 hover:underline sm:inline dark:text-violet-300"
          >
            {t("trustStripCta")}
          </FastLink>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-violet-700/80 transition hover:bg-violet-100 hover:text-violet-900 dark:text-violet-300 dark:hover:bg-violet-950/60"
          aria-label={t("trustStripDismiss")}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
