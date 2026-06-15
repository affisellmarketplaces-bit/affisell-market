import { render } from "@react-email/render"
import { Resend } from "resend"

import { MerchantKycPublishReminderEmail } from "@/emails/merchant-kyc-reminder"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"

export async function sendMerchantKycPublishReminderEmail(args: {
  email: string
  name?: string | null
  draftCount: number
  locale?: "fr" | "en"
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("merchant-kyc-reminder", args.email, config)
  const verifyUrl = `${resolveAppUrl()}/dashboard/verification`

  const html = await render(
    MerchantKycPublishReminderEmail({
      name: args.name?.trim() || (locale === "en" ? "there" : "bonjour"),
      draftCount: args.draftCount,
      verifyUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Your ${args.draftCount} draft listing${args.draftCount > 1 ? "s are" : " is"} waiting — complete KYC`
      : `${args.draftCount} brouillon${args.draftCount > 1 ? "s" : ""} en attente — finalisez votre KYC`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
