"use client"

import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect } from "react"

export default function SupplierNewProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[supplier new product]", error)
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
        Fiche produit
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Impossible d’ouvrir l’éditeur produit
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        Rechargez la page ou revenez au catalogue. Si le problème persiste, contactez le support avec la
        référence ci-dessous.
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
        <Link
          href="/dashboard/supplier/products"
          className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100"
        >
          Mes produits
        </Link>
      </div>
    </main>
  )
}
