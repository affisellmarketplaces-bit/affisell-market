"use client"

import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import {
  CartCheckoutIdentitySheet,
  type CheckoutIdentityPayload,
} from "@/components/cart/cart-checkout-identity-sheet"
import { useCheckoutHandoff } from "@/hooks/use-checkout-handoff"
import { fetchBuyerSessionSnapshot } from "@/lib/buyer-session-client"
import { checkoutStockMessage } from "@/lib/checkout-stock-client"
import {
  buyNowWithoutLogin,
  type BuyNowOutcome,
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
  const { overlay: checkoutHandoff, beginHandoff, endHandoff } = useCheckoutHandoff()
  const tStock = useTranslations("cart.stock")

  const runBuyNow = useCallback(
    async (body: FastCheckoutBody, meta: BuyNowWithoutLoginMeta) => {
      beginHandoff("redirecting")
      const outcome = await buyNowWithoutLogin(body, meta)
      if (outcome !== "stripe") {
        endHandoff()
      }
      // Every caller (PDP, grid cards, discover feed, Pulse) gets the same translated feedback — never a raw code, never silence.
      if (typeof outcome === "object" && outcome.kind === "no_stock") {
        toast.error(checkoutStockMessage(outcome.refusal, tStock))
      }
      return outcome
    },
    [beginHandoff, endHandoff, tStock]
  )

  const buyNow = useCallback(
    async (
      body: FastCheckoutBody,
      meta: BuyNowWithoutLoginMeta
    ): Promise<BuyNowOutcome | "needs_identity"> => {
      const session = await fetchBuyerSessionSnapshot()
      if (!session.isCustomerBuyer) {
        pendingRef.current = { body, meta }
        setCheckoutPayload(body as CheckoutIdentityPayload)
        setIdentityOpen(true)
        return "needs_identity"
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
    const outcome = await runBuyNow(pending.body, pending.meta)
    console.log("[buy-now-identity]", {
      listingId: pending.meta.productId,
      result: typeof outcome === "string" ? outcome : outcome.kind,
    })
  }, [runBuyNow])

  const closeIdentity = useCallback(() => {
    setIdentityOpen(false)
    setCheckoutPayload(null)
    pendingRef.current = null
  }, [])

  const identitySheet = (
    <>
      {checkoutHandoff}
      <CartCheckoutIdentitySheet
        open={identityOpen}
        onClose={closeIdentity}
        onIdentified={onIdentified}
        checkoutPayload={checkoutPayload}
      />
    </>
  )

  return { buyNow, identitySheet, identityOpen }
}
