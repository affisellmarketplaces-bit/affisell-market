import Stripe from "stripe"

import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"

export { assertTransfersActive as assertConnectTransfersActive }

// `createConnectTransfer` (key `tr_<order>_<role>`, no caller since 2026) was removed on 2026-11-25: every Stripe
// transfer is created by lib/payouts/leg-transfer.server.ts (payout leg registry). Only the helpers below remain.

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
