"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { FastLink } from "@/components/navigation/fast-link"
import { cn } from "@/lib/utils"
import {
  brandOrbitTrustStripDismiss,
  brandOrbitTrustStripLink,
  brandOrbitTrustStripShell,
  brandOrbitTrustStripShimmer,
  brandOrbitTrustStripText,
} from "@/lib/affisell-brand-orbit-shared"

/** Session-only dismiss — avoids permanent hide from legacy localStorage key. */
const DISMISS_KEY = "affisell_trust_strip_session_v2"

type Props = {
  visible: boolean
  className?: string
}

export function PublicNavTrustStrip({ visible, className }: Props) {
  const t = useTranslations("PublicNav")
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!visible || dismissed) return null

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div
      className={cn(brandOrbitTrustStripShell, className)}
      role="region"
      aria-label={t("trustStripText")}
    >
      <div className={brandOrbitTrustStripShimmer} aria-hidden />
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-2 px-2 py-2 sm:px-3">
        <p className={brandOrbitTrustStripText}>
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
          <span className="truncate">{t("trustStripText")}</span>
          <FastLink href="/protected-checkout" className={`hidden sm:inline ${brandOrbitTrustStripLink}`}>
            {t("trustStripCta")}
          </FastLink>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className={brandOrbitTrustStripDismiss}
          aria-label={t("trustStripDismiss")}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
