"use client"

import { useState } from "react"
import { toast } from "sonner"

const SETUP_DOC = "docs/STRIPE_RADAR_SETUP.md"
const GLOBAL_NOT_CONFIGURED_TOAST =
  "Plan Global non configuré - voir docs/STRIPE_RADAR_SETUP.md"

type CheckoutErrorBody = {
  error?: string
  message?: string
  url?: string
}

export function AdminRadarCheckoutFallback() {
  const [loading, setLoading] = useState(false)

  async function testGlobalCheckout() {
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/create-radar-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "global", returnPath: "/admin/radar" }),
      })
      const data = (await res.json()) as CheckoutErrorBody

      if (res.status === 503 && data.error === "STRIPE_GLOBAL_NOT_CONFIGURED") {
        toast.error(GLOBAL_NOT_CONFIGURED_TOAST)
        return
      }

      if (!res.ok || !data.url) {
        toast.error(data.message ?? data.error ?? "Échec checkout Radar Global")
        return
      }

      window.location.href = data.url
    } catch {
      toast.error("Échec checkout Radar Global")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Checkout Stripe Global ($99)
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Si{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
          STRIPE_RADAR_GLOBAL_PRICE_ID
        </code>{" "}
        manque → 503 + toast (pas de 500). Guide repo :{" "}
        <code className="rounded bg-zinc-100 px-1 text-[11px] dark:bg-zinc-900">
          {SETUP_DOC}
        </code>
        .
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void testGlobalCheckout()}
        className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
      >
        {loading ? "Checkout…" : "Tester checkout Global"}
      </button>
    </div>
  )
}
