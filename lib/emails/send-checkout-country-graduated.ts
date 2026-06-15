import { render } from "@react-email/render"
import { Resend } from "resend"

import { CheckoutCountryGraduatedEmail } from "@/emails/checkout-country-graduated"
import { expansionGraduatedResendTags } from "@/lib/expansion/expansion-email-tags"
import { resolveGraduatedBuyerShopUrl } from "@/lib/expansion/graduated-buyer-shop-url"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"

export async function sendCheckoutCountryGraduatedEmail(args: {
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
  const { to } = resolveResendDeliveryRecipient("checkout-country-graduated", args.email, config)
  const shopUrl = resolveGraduatedBuyerShopUrl(args.countryIso2)

  const html = await render(
    CheckoutCountryGraduatedEmail({
      countryName: args.countryName,
      shopUrl,
      locale,
    })
  )

  const subject =
    locale === "en"
      ? `Affisell checkout is permanent in ${args.countryName}`
      : `Checkout Affisell permanent en ${args.countryName}`

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject,
    html,
    tags: expansionGraduatedResendTags(args.countryIso2),
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
