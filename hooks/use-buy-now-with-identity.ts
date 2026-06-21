"use client"

import { useCallback, useRef, useState } from "react"

import { CheckoutIdentitySheet } from "@/components/checkout/checkout-identity-sheet"
import { fetchBuyerSessionSnapshot } from "@/lib/buyer-session-client"
import {
  buyNowWithoutLogin,
  type BuyNowWithoutLoginMeta,
} from "@/lib/guest-buy-now-client"
import type { FastCheckoutBody } from "@/lib/fast-checkout-client"

type PendingBuyNow = {
  body: FastCheckoutBody
  meta: BuyNowWithoutLoginMeta
}

export function useBuyNowWithIdentity() {
  const [identityOpen, setIdentityOpen] = useState(false)
  const pendingRef = useRef<PendingBuyNow | null>(null)

  const runBuyNow = useCallback(async (body: FastCheckoutBody, meta: BuyNowWithoutLoginMeta) => {
    return buyNowWithoutLogin(body, meta)
  }, [])

  const buyNow = useCallback(
    async (body: FastCheckoutBody, meta: BuyNowWithoutLoginMeta) => {
      const session = await fetchBuyerSessionSnapshot()
      if (!session.isCustomerBuyer) {
        pendingRef.current = { body, meta }
        setIdentityOpen(true)
        return "needs_identity" as const
      }
      return runBuyNow(body, meta)
    },
    [runBuyNow]
  )

  const onIdentified = useCallback(async () => {
    setIdentityOpen(false)
    const pending = pendingRef.current
    pendingRef.current = null
    if (!pending) return null
    return runBuyNow(pending.body, pending.meta)
  }, [runBuyNow])

  const closeIdentity = useCallback(() => {
    setIdentityOpen(false)
    pendingRef.current = null
  }, [])

  const identitySheet = (
    <CheckoutIdentitySheet open={identityOpen} onClose={closeIdentity} onIdentified={onIdentified} />
  )

  return { buyNow, identitySheet, identityOpen }
}
