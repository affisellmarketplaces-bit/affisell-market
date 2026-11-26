"use client"

import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect, useMemo } from "react"

import { APP_ERROR_COPY, type AppErrorCopy } from "@/lib/app-error-copy"
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n-locale"

const isAppLocale = (v: string | undefined): v is AppLocale => !!v && (SUPPORTED_LOCALES as readonly string[]).includes(v)

function readLocaleFromDocument(): AppLocale {
  if (typeof document === "undefined") return "en"
  const cookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
  const fromCookie = cookie?.split("=")[1]?.trim()
  if (isAppLocale(fromCookie)) return fromCookie
  const lang = document.documentElement.lang?.toLowerCase().slice(0, 2)
  return isAppLocale(lang) ? lang : "en"
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useMemo(() => readLocaleFromDocument(), [])

  const t: AppErrorCopy = APP_ERROR_COPY[locale]

  useEffect(() => {
    console.error("[app error]", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
      cause: error.cause,
    })
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="affisell-error-main">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
        {t.label}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.body}</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-zinc-400">Ref: {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          {t.retry}
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-white/80 dark:border-zinc-600 dark:hover:bg-zinc-800/80"
        >
          {t.home}
        </Link>
      </div>
    </main>
  )
}
