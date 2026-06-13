"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import {
  PaymentSuccessLoading,
  PaymentSuccessScreen,
  type PaymentSuccessPayload,
} from "@/components/checkout/payment-success-screen"

function SuccessContent() {
  const searchParams = useSearchParams()
  const handled = useRef(false)
  const [payload, setPayload] = useState<PaymentSuccessPayload | null>(null)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const sessionId = searchParams.get("session_id")
    if (!sessionId) {
      setPayload({ error: "missing_session" })
      return
    }

    fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data: PaymentSuccessPayload) => setPayload(data))
      .catch(() => setPayload({ error: "verify_failed" }))
  }, [searchParams])

  if (!payload) {
    return <PaymentSuccessLoading />
  }

  return <PaymentSuccessScreen payload={payload} />
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessLoading />}>
      <SuccessContent />
    </Suspense>
  )
}
