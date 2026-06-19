import { Suspense } from "react"

import { fulfillPaidCheckoutSession } from "@/lib/marketplace-checkout-success.server"

import { optimisticPayload, SuccessClient } from "./success-client"

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
    <Suspense fallback={<SuccessClient sessionId={sessionId} initialPayload={optimisticPayload()} />}>
      <SuccessClient sessionId={sessionId} initialPayload={initialPayload} />
    </Suspense>
  )
}
