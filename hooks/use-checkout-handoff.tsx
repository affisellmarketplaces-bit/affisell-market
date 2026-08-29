"use client"

import { useCallback, useState } from "react"

import { CheckoutPaymentHandoff } from "@/components/checkout/checkout-payment-handoff"

/** Instant full-screen overlay while checkout API → Stripe redirect runs. */
export function useCheckoutHandoff() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"identifying" | "redirecting">("redirecting")

  const beginHandoff = useCallback((nextPhase: "identifying" | "redirecting" = "redirecting") => {
    setPhase(nextPhase)
    setOpen(true)
  }, [])

  const endHandoff = useCallback(() => {
    setOpen(false)
  }, [])

  const overlay = <CheckoutPaymentHandoff open={open} phase={phase} />

  return { overlay, beginHandoff, endHandoff, handoffOpen: open }
}
