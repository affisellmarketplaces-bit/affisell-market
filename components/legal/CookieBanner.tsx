"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import {
  applyConsentChoice,
  COOKIE_CONSENT_CHANGED_EVENT,
  readCookieConsentPrefsFromDocument,
  removeNonEssentialCookies,
} from "@/lib/legal/cookie-consent-runtime"
import { isImmersiveBuyerRoute } from "@/lib/mobile-chrome"

const STORAGE_KEY = "affisell_cookie_consent_ui"

type StoredChoice = "accepted" | "refused"

function readLocalChoice(): StoredChoice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === "accepted" || v === "refused") return v
  } catch {
    /* private mode */
  }
  return null
}

function writeLocalChoice(choice: StoredChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    /* ignore */
  }
}

/** Bandeau cookies RGPD — synchro cookie runtime Affisell + i18n. */
export default function CookieBanner() {
  const pathname = usePathname() ?? ""
  const t = useTranslations("cookieBanner")
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isImmersiveBuyerRoute(pathname)) {
      setVisible(false)
      return
    }
    const local = readLocalChoice()
    const prefs = readCookieConsentPrefsFromDocument()
    if (local || prefs) {
      setVisible(false)
      return
    }
    setVisible(true)
  }, [pathname])

  useEffect(() => {
    const onChange = () => setVisible(false)
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange)
  }, [])

  if (!visible || isImmersiveBuyerRoute(pathname)) return null

  const accept = () => {
    writeLocalChoice("accepted")
    applyConsentChoice({
      essential: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    })
    void fetch("/api/legal/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice: "accepted", analytics: true, marketing: true }),
    }).catch(() => undefined)
    setVisible(false)
  }

  const refuse = () => {
    writeLocalChoice("refused")
    applyConsentChoice({
      essential: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
    })
    removeNonEssentialCookies()
    void fetch("/api/legal/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice: "refused", analytics: false, marketing: false }),
    }).catch(() => undefined)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label={t("aria")}
      className="fixed inset-x-0 bottom-[var(--affisell-mobile-dock-offset,0px)] z-[9999] p-3 md:bottom-4 md:left-1/2 md:max-w-2xl md:-translate-x-1/2 md:p-0"
    >
      <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-xl shadow-zinc-900/10 backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-950/90 sm:p-5">
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {t("body")}{" "}
          <Link href="/legal/cookies" className="font-medium text-zinc-900 underline underline-offset-2 dark:text-white">
            {t("learnMore")}
          </Link>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={accept}
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-zinc-900"
          >
            {t("accept")}
          </button>
          <button
            type="button"
            onClick={refuse}
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 bg-white/80 px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {t("refuse")}
          </button>
          <Link
            href="/cookies"
            className="ml-auto text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            {t("configure")}
          </Link>
        </div>
      </div>
    </div>
  )
}
