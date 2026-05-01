"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

export function BuyButton({
  productId,
  cancelPath,
  successPath,
}: {
  productId: string
  cancelPath: string
  successPath: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const affiliateId = useMemo(() => {
    if (typeof document === "undefined") return ""
    const match = document.cookie
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("aff_ref="))
    return match ? decodeURIComponent(match.split("=")[1]) : ""
  }, [])

  async function buy() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          affiliateId,
          cancelPath,
          successPath,
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed")
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
      setLoading(false)
    }
  }

  const ta = useTranslations("affiliate")

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={buy}
        disabled={loading}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {loading ? ta("redirecting") : ta("buy")}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
