export type FastCheckoutBody = {
  productId?: string
  affiliateProductId?: string
  qty?: number
  bookingSlotId?: string
  useRewardCents?: number
  selectedColor?: string | null
  selectedSize?: string | null
  successPath?: string
  cancelPath?: string
  items?: unknown[]
}

export type FastCheckoutSuccess = { ok: true; status: "redirected" }
export type FastCheckoutFailure = {
  ok: false
  status: "auth" | "error"
  message?: string
}
export type FastCheckoutResult = FastCheckoutSuccess | FastCheckoutFailure

export function fastCheckoutRedirected(
  result: FastCheckoutResult
): result is FastCheckoutSuccess {
  return result.ok && result.status === "redirected"
}

export function fastCheckoutNeedsLogin(result: FastCheckoutResult): boolean {
  return !result.ok && result.status === "auth"
}

/**
 * One-tap buy: redirect as soon as Stripe URL is returned (`location.assign` + keepalive).
 */
/**
 * One-tap buy → Stripe Checkout. No login required beforehand;
 * Stripe collects email/phone; buyer account is created after payment if needed.
 */
export async function startFastCheckout(
  body: FastCheckoutBody,
  _options?: { loginCallbackUrl?: string }
): Promise<FastCheckoutResult> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    keepalive: true,
  })

  const data = (await res.json()) as { url?: string; error?: string }
  if (data.url) {
    window.location.assign(data.url)
    return { ok: true, status: "redirected" }
  }

  if (res.status === 401) {
    return { ok: false, status: "auth", message: data.error }
  }

  return { ok: false, status: "error", message: data.error }
}
