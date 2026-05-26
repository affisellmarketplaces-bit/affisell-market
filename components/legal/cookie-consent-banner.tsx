"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { COOKIE_CONSENT_COOKIE, type CookieConsentPrefs } from "@/lib/legal/consent"
import { cn } from "@/lib/utils"

const MAX_AGE = 60 * 60 * 24 * 395

function readConsentCookie(): CookieConsentPrefs | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_CONSENT_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as CookieConsentPrefs
    return parsed?.essential === true ? parsed : null
  } catch {
    return null
  }
}

function writeConsentCookie(prefs: CookieConsentPrefs) {
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))};path=/;max-age=${MAX_AGE};SameSite=Lax`
  window.dispatchEvent(new CustomEvent("affisell:cookie-consent", { detail: prefs }))
}

async function syncConsentToAccount(prefs: CookieConsentPrefs) {
  try {
    await fetch("/api/gdpr/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    })
  } catch {
    /* logged-out or network */
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    const existing = readConsentCookie()
    if (!existing) {
      setVisible(true)
      return
    }
    setAnalytics(existing.analytics)
    setMarketing(existing.marketing)
  }, [])

  function save(prefs: CookieConsentPrefs) {
    writeConsentCookie(prefs)
    void syncConsentToAccount(prefs)
    setVisible(false)
    setCustomize(false)
  }

  function acceptAll() {
    save({ essential: true, analytics: true, marketing: true, updatedAt: new Date().toISOString() })
  }

  function rejectOptional() {
    save({ essential: true, analytics: false, marketing: false, updatedAt: new Date().toISOString() })
  }

  function saveCustom() {
    save({
      essential: true,
      analytics,
      marketing,
      updatedAt: new Date().toISOString(),
    })
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-zinc-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 sm:p-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div>
          <h2 id="cookie-banner-title" className="text-base font-semibold text-zinc-900 dark:text-white">
            Respect de votre vie privée
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Nous utilisons des cookies essentiels et, avec votre accord, des cookies analytics et marketing.{" "}
            <Link href="/legal/cookies-policy" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
              En savoir plus
            </Link>
          </p>
        </div>

        {customize ? (
          <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium text-zinc-900 dark:text-white">Essentiels</span>
                <span className="block text-xs text-zinc-500">Toujours actifs (session, langue)</span>
              </span>
              <input type="checkbox" checked disabled className="size-4" />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium text-zinc-900 dark:text-white">Analytics</span>
                <span className="block text-xs text-zinc-500">Vercel Analytics — audience agrégée</span>
              </span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="size-4 rounded border-zinc-300 text-violet-600"
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium text-zinc-900 dark:text-white">Marketing</span>
                <span className="block text-xs text-zinc-500">Désactivé par défaut</span>
              </span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="size-4 rounded border-zinc-300 text-violet-600"
              />
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Tout accepter
          </button>
          <button
            type="button"
            onClick={rejectOptional}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Refuser l&apos;optionnel
          </button>
          <button
            type="button"
            onClick={() => (customize ? saveCustom() : setCustomize(true))}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold",
              customize
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
            )}
          >
            {customize ? "Enregistrer mes choix" : "Personnaliser"}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Gate Vercel Analytics on analytics consent. */
export function useAnalyticsConsent(): boolean {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const read = () => setAllowed(readConsentCookie()?.analytics === true)
    read()
    window.addEventListener("affisell:cookie-consent", read)
    return () => window.removeEventListener("affisell:cookie-consent", read)
  }, [])

  return allowed
}
