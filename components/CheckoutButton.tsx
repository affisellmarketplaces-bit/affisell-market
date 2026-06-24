"use client"

import { loadStripe } from "@stripe/stripe-js"
import { useCallback, useState } from "react"

type CheckoutButtonProps = {
  cartId: string
  className?: string
  label?: string
  returnUrl?: string
}

/**
 * Medusa v2 + Stripe Payment Intent checkout.
 * Uses client_secret from POST /api/checkout { cart_id, medusa: true }.
 */
export function CheckoutButton({
  cartId,
  className,
  label = "Pay with Stripe",
  returnUrl,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCheckout = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      if (!publishableKey) {
        throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured")
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_id: cartId, medusa: true }),
      })
      const data = (await res.json()) as { client_secret?: string; error?: string }
      if (!res.ok || !data.client_secret) {
        throw new Error(data.error ?? "Failed to create payment session")
      }

      const stripe = await loadStripe(publishableKey)
      if (!stripe) throw new Error("Stripe.js failed to load")

      const redirect =
        returnUrl ??
        `${window.location.origin}/checkout/success?cart_id=${encodeURIComponent(cartId)}`

      const { error: confirmError } = await stripe.confirmPayment({
        clientSecret: data.client_secret,
        confirmParams: { return_url: redirect },
      })

      if (confirmError) throw new Error(confirmError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setLoading(false)
    }
  }, [cartId, returnUrl])

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onCheckout()}
        disabled={loading || !cartId}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
