import { render } from "@react-email/render"
import { Resend } from "resend"

import { CheckoutCountryLaunchEmail } from "@/emails/checkout-country-launch"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"

export async function sendCheckoutCountryLaunchEmail(args: {
  email: string
  countryIso2: string
  countryName: string
  locale?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("checkout-country-launch", args.email, config)
  const shopUrl = `${resolveAppUrl()}/marketplace`

  const html = await render(
    CheckoutCountryLaunchEmail({
      countryName: args.countryName,
      shopUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Checkout is live in ${args.countryName} — shop on Affisell`
      : `Checkout ouvert en ${args.countryName} — achetez sur Affisell`

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
