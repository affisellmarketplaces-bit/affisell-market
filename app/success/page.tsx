import { Suspense } from "react"

import { PaymentSuccessLoading } from "@/components/checkout/payment-success-screen"
import { fulfillPaidCheckoutSession } from "@/lib/marketplace-checkout-success.server"

import { SuccessClient } from "./success-client"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ session_id?: string }>
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const params = await searchParams
  const sessionId = params.session_id?.trim() ?? ""

  let initialPayload = null
  if (sessionId) {
    try {
      const result = await fulfillPaidCheckoutSession(sessionId)
      initialPayload = { ...result, verifying: false }
    } catch (error) {
      console.error("[checkout-success]", {
        sessionId,
        result: "server_fulfill_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <Suspense fallback={<PaymentSuccessLoading />}>
      <SuccessClient sessionId={sessionId} initialPayload={initialPayload} />
    </Suspense>
  )
}
