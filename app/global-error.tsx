"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useMemo } from "react"

import "./globals.css"
import { globalErrorCopy, readGlobalErrorLocale } from "@/lib/global-error-copy"

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
  const locale = useMemo(() => readGlobalErrorLocale(), [])
  const t = useMemo(() => globalErrorCopy(locale), [locale])

  useEffect(() => {
    console.error("[global error]", {
      message: error.message,
      name: error.name,
      digest: error.digest,
    })
    Sentry.captureException(error)
  }, [error])

  const htmlLang = locale === "zh" ? "zh-CN" : locale

  return (
    <html lang={htmlLang}>
      <body className="min-h-dvh bg-zinc-50 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <main className="affisell-error-main min-h-dvh">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            {t.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.body}</p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-zinc-400">{t.ref.replace("{digest}", error.digest)}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              {t.retry}
            </button>
            <a
              href="/api/auth/signout?callbackUrl=/"
              className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-white dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {t.signOut}
            </a>
            <a
              href="/"
              className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-white dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {t.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
