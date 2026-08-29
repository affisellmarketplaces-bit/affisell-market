"use client"

import { useEffect } from "react"

const STRIPE_WARMUP_HINTS = [
  { rel: "dns-prefetch", href: "https://checkout.stripe.com" },
  { rel: "preconnect", href: "https://checkout.stripe.com", crossOrigin: "anonymous" as const },
  { rel: "dns-prefetch", href: "https://js.stripe.com" },
  { rel: "preconnect", href: "https://js.stripe.com", crossOrigin: "anonymous" as const },
]

/** Warm Stripe Checkout DNS/TLS as soon as the buyer reaches a PDP or cart. */
export function StripeCheckoutWarmup() {
  useEffect(() => {
    for (const hint of STRIPE_WARMUP_HINTS) {
      const selector = `link[rel="${hint.rel}"][href="${hint.href}"]`
      if (document.head.querySelector(selector)) continue
      const link = document.createElement("link")
      link.rel = hint.rel
      link.href = hint.href
      if (hint.crossOrigin) {
        link.crossOrigin = hint.crossOrigin
      }
      document.head.appendChild(link)
    }
  }, [])

  return null
}
