"use client"

import { useMemo, useState } from "react"

export function BuyButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const affiliateId = useMemo(() => {
    if (typeof document === "undefined") return ""
    const match = document.cookie
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("affiliate_ref="))
    return match ? decodeURIComponent(match.split("=")[1]) : ""
  }, [])

  async function buy() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, affiliateId }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Impossible de lancer le paiement")
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={buy}
        disabled={loading}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? "Redirection..." : "Acheter"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
