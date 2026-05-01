"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

export function MarketplaceCheckoutButton({
  affiliateProductId,
  cancelPath,
  successPath,
}: {
  affiliateProductId: string
  cancelPath: string
  successPath: string
}) {
  const [loading, setLoading] = useState(false)
  const t = useTranslations("boutique")

  async function checkout() {
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateProductId, cancelPath, successPath }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed")
      }
      window.location.href = data.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={checkout}
      className="mt-6 w-full rounded-md bg-black py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {loading ? "…" : t("buy")}
    </button>
  )
}
