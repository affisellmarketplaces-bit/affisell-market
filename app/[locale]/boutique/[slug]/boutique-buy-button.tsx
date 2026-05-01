"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

type Props = {
  productId: string
  affiliateId: string
  cancelPath: string
  successPath: string
}

export function BoutiqueBuyButton({ productId, affiliateId, cancelPath, successPath }: Props) {
  const [loading, setLoading] = useState(false)
  const t = useTranslations("boutique")
  const ta = useTranslations("affiliate")

  async function checkout() {
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, affiliateId, cancelPath, successPath }),
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
      className="mt-4 w-full rounded-md bg-black py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black"
    >
      {loading ? ta("redirecting") : t("buy")}
    </button>
  )
}
