"use client"

import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect } from "react"

import { Providers } from "@/app/providers"
import { STOREFRONT_HTML_LANG } from "@/lib/market-config"

import "./globals.css"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[global error]", error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang={STOREFRONT_HTML_LANG}>
      <body className="min-h-dvh bg-gradient-to-b from-violet-50/80 via-white to-zinc-50 text-zinc-900 antialiased dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-50">
        <Providers timeZone="Europe/Paris">
          <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Something went wrong
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">We hit a snag</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              A problem occurred while loading this page. You can retry, or go back to the home page.
            </p>
            {error.digest ? (
              <p className="mt-2 font-mono text-xs text-zinc-400">Ref: {error.digest}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-white/80 dark:border-zinc-600 dark:hover:bg-zinc-800/80"
              >
                Home
              </Link>
            </div>
          </main>
        </Providers>
      </body>
    </html>
  )
}
