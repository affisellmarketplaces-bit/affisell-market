import { render } from "@react-email/render"
import { Resend } from "resend"

import { WishlistPriceAlertEmail } from "@/emails/wishlist-price-alert"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import {
  formatWishlistPriceEur,
  type WishlistPriceAlertEvaluation,
} from "@/lib/wishlist-price-alert"

export type SendWishlistPriceAlertArgs = {
  toEmail: string
  customerName: string
  productName: string
  listingUrl: string
  currentPriceCents: number
  targetPriceCents: number | null
  evaluation: WishlistPriceAlertEvaluation
}

export async function sendWishlistPriceAlertEmail(
  args: SendWishlistPriceAlertArgs
): Promise<boolean> {
  const resendConfig = readResendDeliveryConfig()
  if (!resendConfig || !args.toEmail.trim()) return false

  const resend = new Resend(resendConfig.apiKey)
  const currentPriceLabel = formatWishlistPriceEur(args.currentPriceCents)
  const targetPriceLabel =
    args.targetPriceCents != null ? formatWishlistPriceEur(args.targetPriceCents) : null

  const html = await render(
    WishlistPriceAlertEmail({
      customerName: args.customerName.trim() || "there",
      productName: args.productName,
      currentPriceLabel,
      dropPercent: args.evaluation.dropPercent,
      targetPriceLabel,
      listingUrl: args.listingUrl,
    })
  )

  const subject =
    args.evaluation.dropPercent > 0
      ? `Baisse de prix: ${args.productName}`
      : `Prix cible atteint: ${args.productName}`

  const { to } = resolveResendDeliveryRecipient("wishlist-price-alert", args.toEmail, resendConfig)
  await resend.emails.send({
    from: resendConfig.from,
    to,
    subject,
    html,
  })
  return true
}
