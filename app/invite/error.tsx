"use client"

import Link from "next/link"
import { useEffect } from "react"

export default function InviteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[invite error]", error)
  }, [error])

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <h1 className="text-xl font-semibold">Invitation indisponible</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        Le lien est invalide, expiré, ou le service est temporairement indisponible. Réessayez dans un instant.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-zinc-600">Réf. {error.digest}</p> : null}
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900"
        >
          Réessayer
        </button>
        <Link href="/" className="rounded-xl border border-zinc-600 px-5 py-2.5 text-sm font-medium">
          Accueil
        </Link>
      </div>
    </div>
  )
}
