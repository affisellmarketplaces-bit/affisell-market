import "server-only"

const DEFAULT_MEDUSA_URL = "http://localhost:9000"
export const MEDUSA_STRIPE_PROVIDER_ID = "pp_stripe_stripe"

export function medusaBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.trim() ||
    DEFAULT_MEDUSA_URL
  ).replace(/\/$/, "")
}

export function medusaPublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim() || undefined
}

export function medusaStoreHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  const key = medusaPublishableKey()
  if (key) headers["x-publishable-api-key"] = key
  return headers
}

type MedusaCart = {
  id: string
  payment_collection?: { id?: string } | null
  payment_collection_id?: string | null
}

type PaymentSessionData = {
  client_secret?: string
  id?: string
}

type PaymentSession = {
  id: string
  provider_id?: string
  data?: PaymentSessionData
}

export type MedusaPaymentSessionResult = {
  cart_id: string
  payment_collection_id: string
  payment_session_id: string
  client_secret: string
}

export async function createMedusaStripePaymentSession(
  cartId: string
): Promise<MedusaPaymentSessionResult> {
  const base = medusaBackendUrl()
  const headers = medusaStoreHeaders()

  const cartRes = await fetch(
    `${base}/store/carts/${encodeURIComponent(cartId)}?fields=id,*payment_collection`,
    { headers, cache: "no-store" }
  )
  if (!cartRes.ok) {
    const text = await cartRes.text()
    throw new Error(`Medusa cart fetch failed (${cartRes.status}): ${text}`)
  }

  const cartBody = (await cartRes.json()) as { cart?: MedusaCart }
  const cart = cartBody.cart
  if (!cart?.id) throw new Error("Medusa cart not found")

  const paymentCollectionId =
    cart.payment_collection?.id ?? cart.payment_collection_id ?? null
  if (!paymentCollectionId) {
    throw new Error("Cart has no payment_collection — add items + set region first")
  }

  const sessionRes = await fetch(
    `${base}/store/payment-collections/${encodeURIComponent(paymentCollectionId)}/payment-sessions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ provider_id: MEDUSA_STRIPE_PROVIDER_ID }),
    }
  )

  if (!sessionRes.ok) {
    const text = await sessionRes.text()
    throw new Error(`Medusa payment session failed (${sessionRes.status}): ${text}`)
  }

  const sessionBody = (await sessionRes.json()) as {
    payment_collection?: {
      payment_sessions?: PaymentSession[]
    }
  }

  const sessions = sessionBody.payment_collection?.payment_sessions ?? []
  const stripeSession =
    sessions.find((s) => s.provider_id === MEDUSA_STRIPE_PROVIDER_ID) ?? sessions[0]

  const clientSecret = stripeSession?.data?.client_secret
  if (!stripeSession?.id || !clientSecret) {
    throw new Error("Stripe payment session missing client_secret")
  }

  console.log("[medusa-checkout]", {
    cartId,
    paymentCollectionId,
    paymentSessionId: stripeSession.id,
    result: "session_created",
  })

  return {
    cart_id: cartId,
    payment_collection_id: paymentCollectionId,
    payment_session_id: stripeSession.id,
    client_secret: clientSecret,
  }
}
