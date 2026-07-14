"use client"

import { useSearchParams } from "next/navigation"

export default function IntelliConnectPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  function startOAuth() {
    window.location.href = "/api/intelli/tiktok/start"
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Connexion TikTok Shop</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Vous serez redirigé vers TikTok pour autoriser l&apos;accès à votre boutique. Les tokens sont
          chiffrés au repos (AES-256-GCM).
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Connexion échouée ({error}). Réessayez ou contactez le support.
          </div>
        )}

        <button
          type="button"
          onClick={startOAuth}
          className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Connecter avec TikTok Shop
        </button>
      </section>
    </div>
  )
}
