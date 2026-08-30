"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useState } from "react"

import "./globals.css"
import { LOCALE_COOKIE, DEFAULT_LOCALE, resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

function readLocaleCookie(): AppLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))
  return resolveAppLocale(match?.[1] ? decodeURIComponent(match[1]) : null)
}

/**
 * Root error UI — keep minimal (no SessionProvider / next-intl) so "Try again" can recover.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocale(readLocaleCookie())
    console.error("[global error]", error)
    Sentry.captureException(error)
  }, [error])

  const htmlLang = locale === "zh" ? "zh-CN" : locale

  return (
    <html lang={htmlLang}>
      <body className="min-h-dvh bg-zinc-50 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <main className="affisell-error-main min-h-dvh">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            {tMessage(locale, "globalError.eyebrow")}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{tMessage(locale, "globalError.title")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {tMessage(locale, "globalError.body")}
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-zinc-400">
              {tMessage(locale, "globalError.ref").replace("{digest}", error.digest)}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              {tMessage(locale, "globalError.retry")}
            </button>
            <a
              href="/"
              className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-white dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {tMessage(locale, "globalError.home")}
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
