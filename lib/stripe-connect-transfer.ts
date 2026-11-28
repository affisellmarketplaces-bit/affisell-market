import Stripe from "stripe"

import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"

export { assertTransfersActive as assertConnectTransfersActive }

// `createConnectTransfer` was removed (2026-11-27): no caller left, and its idempotency key `tr_<order>_<role>` and
// lowercase `role` differed from process-transfers (`transfer_<order>_<ROLE>`), so a call next to the job could pay the
// same leg twice — the pattern of Test order cmpjs9s0m0007th1idac73yny. Every marketplace leg goes through
// lib/transfers/process-transfers.ts (or Lightning, behind its lock).

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
