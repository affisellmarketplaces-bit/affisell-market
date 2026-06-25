import "server-only"

import { NextResponse } from "next/server"

import {
  STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
} from "@/lib/stripe-minimum"

/** Block checkout before Stripe when total due is below platform minimum (avoids 500 + Sentry). */
export function stripeCheckoutMinimumNotMetResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "checkout_minimum_not_met",
      minAmountCents: STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
    },
    { status: 400 }
  )
}
