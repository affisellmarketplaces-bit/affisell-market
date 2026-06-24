import { Suspense } from "react"

import { fulfillPaidCheckoutSession } from "@/lib/marketplace-checkout-success.server"

import { SuccessClient } from "./success-client"

const OPTIMISTIC_FALLBACK = { paid: true, fulfilled: false, verifying: true } as const

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
    <Suspense fallback={<SuccessClient sessionId={sessionId} initialPayload={OPTIMISTIC_FALLBACK} />}>
      <SuccessClient sessionId={sessionId} initialPayload={initialPayload} />
    </Suspense>
  )
}
