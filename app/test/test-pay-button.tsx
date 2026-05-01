"use client"

import { useState } from "react"

export function TestPayButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }
      if (!data.url) {
        throw new Error("Réponse Stripe sans URL")
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={pay}
        disabled={loading}
        className="rounded-lg bg-neutral-900 px-4 py-3 text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
      >
        {loading ? "Redirection vers Stripe…" : "Payer 5€ test"}
      </button>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
          {error === "Non authentifié" ? (
            <>
              {" "}
              <a href="/api/auth/signin" className="underline">
                Se connecter
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
