import { render } from "@react-email/render"
import { Resend } from "resend"

import { AffiliateWholesaleChangeEmail } from "@/emails/affiliate-wholesale-change"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"

export type SendAffiliateWholesaleChangeEmailArgs = {
  toEmail: string
  affiliateName: string
  productName: string
  variantCount: number
  atLoss: boolean
  productId: string
  listingId: string
}

function buildEditUrl(listingId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://affisell.com"
  return `${base.replace(/\/$/, "")}/dashboard/affiliate?editListing=${encodeURIComponent(listingId)}`
}

export async function sendAffiliateWholesaleChangeEmail(
  args: SendAffiliateWholesaleChangeEmailArgs
): Promise<boolean> {
  const resendConfig = readResendDeliveryConfig()
  if (!resendConfig || !args.toEmail.trim()) return false

  const resend = new Resend(resendConfig.apiKey)
  const editUrl = buildEditUrl(args.listingId)

  const html = await render(
    AffiliateWholesaleChangeEmail({
      affiliateName: args.affiliateName,
      productName: args.productName,
      variantCount: args.variantCount,
      atLoss: args.atLoss,
      editUrl,
    })
  )

  const subject = args.atLoss
    ? `⚠ Marge à perte — ${args.productName}`
    : `Prix fournisseur en hausse — ${args.productName}`

  const { to } = resolveResendDeliveryRecipient(
    "affiliate-wholesale-change",
    args.toEmail,
    resendConfig
  )
  await resend.emails.send({
    from: resendConfig.from,
    to,
    subject,
    html,
  })
  return true
}
