"use client"

import { useEffect } from "react"

import { PaymentSuccessScreen } from "@/components/checkout/payment-success-screen"

export default function SuccessError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[checkout-success]", {
      result: "client_error_boundary",
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <PaymentSuccessScreen
      payload={{
        paid: true,
        fulfilled: false,
        verifying: false,
      }}
    />
  )
}
