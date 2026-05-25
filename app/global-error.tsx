"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import "./globals.css"

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
  useEffect(() => {
    console.error("[global error]", error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <body className="min-h-dvh bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            Erreur
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">La page n&apos;a pas pu se charger</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Un problème est survenu côté serveur. Réessayez ou revenez à l&apos;accueil.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-zinc-400">Réf. {error.digest}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              Réessayer
            </button>
            <a
              href="/"
              className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-white dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Accueil
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
