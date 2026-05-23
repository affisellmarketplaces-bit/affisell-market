import type Stripe from "stripe"

import { handleStripeChargeRefundedWithCommission } from "@/lib/stripe-commission-refund"

export async function handleStripeChargeRefunded(charge: Stripe.Charge): Promise<{
  processedOrderIds: string[]
}> {
  return handleStripeChargeRefundedWithCommission(charge)
}
