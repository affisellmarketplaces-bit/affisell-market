"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import {
  PaymentSuccessScreen,
  type PaymentSuccessPayload,
} from "@/components/checkout/payment-success-screen"

const VERIFY_POLL_MS = 1200
const VERIFY_MAX_ATTEMPTS = 10

function optimisticPayload(): PaymentSuccessPayload {
  return { paid: true, fulfilled: false, verifying: true }
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")?.trim() ?? ""
  const [payload, setPayload] = useState<PaymentSuccessPayload | null>(() =>
    sessionId ? optimisticPayload() : { error: "missing_session" }
  )

  useEffect(() => {
    if (!sessionId) return

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
          }))
          if (attempts < VERIFY_MAX_ATTEMPTS) {
            attempts += 1
            window.setTimeout(() => {
              if (!cancelled) void runVerify()
            }, VERIFY_POLL_MS)
          }
          return
        }

        setPayload({ ...data, verifying: false })

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
  }, [sessionId])

  if (!payload) return null

  return <PaymentSuccessScreen payload={payload} />
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessScreen payload={optimisticPayload()} />}>
      <SuccessContent />
    </Suspense>
  )
}
