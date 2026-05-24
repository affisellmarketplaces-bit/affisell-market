/** Stripe Connect account page (test vs live from secret key). */
export function stripeConnectDashboardUrl(accountId: string): string {
  const id = accountId.trim()
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
  const base = isTest ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com"
  return `${base}/connect/accounts/${id}`
}

export function stripePaymentDashboardUrl(paymentIntentOrChargeId: string): string {
  const id = paymentIntentOrChargeId.trim()
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
  const base = isTest ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com"
  if (id.startsWith("pi_")) return `${base}/payments/${id}`
  if (id.startsWith("ch_")) return `${base}/payments/${id}`
  return `${base}/search?query=${encodeURIComponent(id)}`
}
