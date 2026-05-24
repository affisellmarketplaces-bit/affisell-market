import Stripe from "stripe"

import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { getStripeClient } from "@/lib/stripe"

export { assertTransfersActive as assertConnectTransfersActive }

export async function createConnectTransfer(args: {
  orderId: string
  role: "supplier" | "affiliate"
  amount: number
  destination: string
  sourceTransaction?: string
}) {
  const stripe = getStripeClient()
  await assertTransfersActive(args.destination)

  const transfer = await stripe.transfers.create(
    {
      amount: args.amount,
      currency: "eur",
      destination: args.destination,
      transfer_group: args.orderId,
      ...(args.sourceTransaction ? { source_transaction: args.sourceTransaction } : {}),
      metadata: { orderId: args.orderId, role: args.role },
    },
    { idempotencyKey: `tr_${args.orderId}_${args.role}` }
  )

  logStripeWebhookInfo({
    level: "info",
    metric: "transfer_created",
    orderId: args.orderId,
    role: args.role,
    amount: args.amount,
    destination: args.destination,
    id: transfer.id,
  })

  return transfer
}

export function isAffiliateOnboardingRequiredError(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  const match = error.message.match(/^AFFILIATE_ONBOARDING_REQUIRED:(.+)$/)
  return match?.[1]?.trim() ?? null
}

export function isInsufficientCapabilitiesError(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeError &&
    error.code === "insufficient_capabilities_for_transfer"
  )
}
