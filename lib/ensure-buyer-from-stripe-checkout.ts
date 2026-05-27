import { identifyBuyerForCheckout } from "@/lib/buyer-identify"
import { normalizeBuyerPhone } from "@/lib/buyer-phone"

/**
 * Create or resolve a CUSTOMER user from Stripe checkout contact (post-payment account).
 * Idempotent — safe if webhook replays.
 */
export async function ensureBuyerUserIdFromStripeCheckout(
  customerEmail: string,
  phone?: string | null
): Promise<string | null> {
  const email = customerEmail.trim().toLowerCase()
  if (!email || email === "unknown@checkout" || !email.includes("@")) {
    const digits = phone ? normalizeBuyerPhone(phone) : null
    if (!digits) return null
    const byPhone = await identifyBuyerForCheckout({ channel: "phone", phone: digits })
    return byPhone.ok ? byPhone.userId : null
  }

  const byEmail = await identifyBuyerForCheckout({ channel: "email", email })
  if (byEmail.ok) return byEmail.userId

  return null
}
