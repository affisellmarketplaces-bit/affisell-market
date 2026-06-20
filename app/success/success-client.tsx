"use client"

import { useEffect, useState } from "react"

import {
  PaymentSuccessScreen,
  type PaymentSuccessPayload,
} from "@/components/checkout/payment-success-screen"

const VERIFY_POLL_MS = 1200
const VERIFY_MAX_ATTEMPTS = 10

function optimisticPayload(): PaymentSuccessPayload {
  return { paid: true, fulfilled: false, verifying: true }
}

type Props = {
  sessionId: string
  initialPayload: PaymentSuccessPayload | null
}

export function SuccessClient({ sessionId, initialPayload }: Props) {
  const [payload, setPayload] = useState<PaymentSuccessPayload | null>(() => {
    if (!sessionId) return { error: "missing_session" }
    if (initialPayload) return initialPayload
    return optimisticPayload()
  })

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
  }, [sessionId, initialPayload?.fulfilled])

  if (!payload) return null

  return <PaymentSuccessScreen payload={payload} />
}

export { optimisticPayload }
