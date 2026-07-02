"use client"

import { useEffect, useRef, useState } from "react"
import { signIn, useSession } from "next-auth/react"

import {
  PaymentSuccessScreen,
  type PaymentSuccessPayload,
} from "@/components/checkout/payment-success-screen"
import { notifyBuyerPersonalizationRefresh } from "@/lib/buyer-personalization-refresh.client"

const VERIFY_POLL_MS = 1200
const VERIFY_MAX_ATTEMPTS = 10

function optimisticPayload(): PaymentSuccessPayload {
  return { paid: true, fulfilled: false, verifying: true }
}

async function ensureBuyerSessionAfterCheckout(sessionId: string): Promise<boolean> {
  const res = await fetch("/api/auth/post-checkout-buyer", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ sessionId }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    checkoutMagic?: string
    error?: string
  }
  if (!res.ok || !data.checkoutMagic) {
    console.log("[checkout-success]", {
      sessionId,
      result: "buyer_session_skipped",
      error: data.error ?? res.status,
    })
    return false
  }

  const login = await signIn("credentials", {
    checkoutMagic: data.checkoutMagic,
    redirect: false,
    callbackUrl: "/marketplace/account/orders",
  })
  if (login?.error) {
    console.log("[checkout-success]", {
      sessionId,
      result: "buyer_session_signin_failed",
      error: login.error,
    })
    return false
  }

  console.log("[checkout-success]", { sessionId, result: "buyer_session_opened" })
  return true
}

type Props = {
  sessionId: string
  initialPayload: PaymentSuccessPayload | null
}

export function SuccessClient({ sessionId, initialPayload }: Props) {
  const { data: session, status: sessionStatus } = useSession()
  const buyerSessionAttempted = useRef(false)
  const personalizationNotified = useRef(false)
  const [payload, setPayload] = useState<PaymentSuccessPayload | null>(() => {
    if (!sessionId) return { error: "missing_session" }
    if (initialPayload) return initialPayload
    return optimisticPayload()
  })

  useEffect(() => {
    if (!sessionId) return
    if (!payload?.fulfilled) return
    if (buyerSessionAttempted.current) return
    if (sessionStatus === "loading") return
    if (session?.user?.role === "CUSTOMER") return

    buyerSessionAttempted.current = true
    void ensureBuyerSessionAfterCheckout(sessionId)
  }, [sessionId, payload?.fulfilled, session?.user?.role, sessionStatus])

  useEffect(() => {
    if (!payload?.paid || !payload?.fulfilled) return
    if (personalizationNotified.current) return
    personalizationNotified.current = true
    notifyBuyerPersonalizationRefresh("checkout_success")
    console.log("[checkout-success]", {
      sessionId: sessionId || null,
      result: "personalization_refresh",
    })
  }, [payload?.paid, payload?.fulfilled, sessionId])

  useEffect(() => {
    if (!sessionId) return
    if (initialPayload?.fulfilled) return

    let cancelled = false
    let attempts = 0

    async function runVerify() {
      try {
        const res = await fetch(
          `/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`,
          { credentials: "include", cache: "no-store" }
        )
        const data = (await res.json()) as PaymentSuccessPayload
        if (cancelled) return

        if (!res.ok) {
          setPayload((prev) => ({
            paid: prev?.paid ?? true,
            fulfilled: false,
            verifying: attempts < VERIFY_MAX_ATTEMPTS,
            amountTotal: prev?.amountTotal,
            currency: prev?.currency,
            productName: prev?.productName,
            productImageUrl: prev?.productImageUrl,
          }))
          if (attempts < VERIFY_MAX_ATTEMPTS) {
            attempts += 1
            window.setTimeout(() => {
              if (!cancelled) void runVerify()
            }, VERIFY_POLL_MS)
          }
          return
        }

        setPayload((prev) => ({
          ...data,
          verifying: false,
          amountTotal: data.amountTotal ?? prev?.amountTotal,
          currency: data.currency ?? prev?.currency,
          productName: data.productName ?? prev?.productName,
          productImageUrl: data.productImageUrl ?? prev?.productImageUrl,
        }))

        if (
          data.paid &&
          data.fulfilled &&
          !buyerSessionAttempted.current &&
          sessionStatus !== "loading" &&
          session?.user?.role !== "CUSTOMER"
        ) {
          buyerSessionAttempted.current = true
          void ensureBuyerSessionAfterCheckout(sessionId)
        }

        if (data.paid && !data.fulfilled && attempts < VERIFY_MAX_ATTEMPTS) {
          attempts += 1
          window.setTimeout(() => {
            if (!cancelled) void runVerify()
          }, VERIFY_POLL_MS)
        }
      } catch {
        if (cancelled) return
        setPayload((prev) => ({
          paid: prev?.paid ?? true,
          fulfilled: false,
          verifying: false,
        }))
      }
    }

    void runVerify()

    return () => {
      cancelled = true
    }
  }, [sessionId, initialPayload?.fulfilled, session?.user?.role, sessionStatus])

  if (!payload) return null

  const signedInAsBuyer = session?.user?.role === "CUSTOMER"

  return <PaymentSuccessScreen payload={payload} signedInAsBuyer={signedInAsBuyer} />
}

export { optimisticPayload }
