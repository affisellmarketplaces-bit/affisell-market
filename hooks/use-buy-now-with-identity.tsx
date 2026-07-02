"use client"

import { useCallback, useRef, useState } from "react"

import {
  CartCheckoutIdentitySheet,
  type CheckoutIdentityPayload,
} from "@/components/cart/cart-checkout-identity-sheet"
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
  const [checkoutPayload, setCheckoutPayload] = useState<CheckoutIdentityPayload | null>(null)
  const pendingRef = useRef<PendingBuyNow | null>(null)

  const runBuyNow = useCallback(async (body: FastCheckoutBody, meta: BuyNowWithoutLoginMeta) => {
    return buyNowWithoutLogin(body, meta)
  }, [])

  const buyNow = useCallback(
    async (body: FastCheckoutBody, meta: BuyNowWithoutLoginMeta) => {
      const session = await fetchBuyerSessionSnapshot()
      if (!session.isCustomerBuyer) {
        pendingRef.current = { body, meta }
        setCheckoutPayload(body as CheckoutIdentityPayload)
        setIdentityOpen(true)
        return "needs_identity" as const
      }
      return runBuyNow(body, meta)
    },
    [runBuyNow]
  )

  const onIdentified = useCallback(async () => {
    setIdentityOpen(false)
    setCheckoutPayload(null)
    const pending = pendingRef.current
    pendingRef.current = null
    if (!pending) return
    await runBuyNow(pending.body, pending.meta)
  }, [runBuyNow])

  const closeIdentity = useCallback(() => {
    setIdentityOpen(false)
    setCheckoutPayload(null)
    pendingRef.current = null
  }, [])

  const identitySheet = (
    <CartCheckoutIdentitySheet
      open={identityOpen}
      onClose={closeIdentity}
      onIdentified={onIdentified}
      checkoutPayload={checkoutPayload}
    />
  )

  return { buyNow, identitySheet, identityOpen }
}
