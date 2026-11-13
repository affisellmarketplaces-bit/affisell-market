import Stripe from 'stripe'

import { assertStripeKeyAllowed } from '@/lib/stripe-key-guard'

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  // A LIVE key is refused outside production (Preview, a laptop): lib/stripe-key-guard.ts — finalisation master K1.
  assertStripeKeyAllowed(key)
  return new Stripe(key)
}
