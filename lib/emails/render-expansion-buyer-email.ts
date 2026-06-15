import { render } from "@react-email/render"

import { CheckoutCountryGraduatedEmail } from "@/emails/checkout-country-graduated"
import { CheckoutCountryLaunchFollowupEmail } from "@/emails/checkout-country-launch-followup"
import { CheckoutCountryLaunchEmail } from "@/emails/checkout-country-launch"
import { renderCheckoutCountryLaunchEmailHtml } from "@/lib/emails/render-checkout-country-launch-email"
import { expansionCountryLabel } from "@/lib/expansion/expansion-country-label"
import { resolveGraduatedBuyerShopUrl } from "@/lib/expansion/graduated-buyer-shop-url"

export type ExpansionBuyerEmailKind = "launch" | "followup" | "graduated"

export async function renderExpansionBuyerEmailHtml(args: {
  kind: ExpansionBuyerEmailKind
  countryIso2: string
  locale?: "en" | "fr"
}): Promise<string> {
  if (args.kind === "launch") {
    return renderCheckoutCountryLaunchEmailHtml({
      countryIso2: args.countryIso2,
      locale: args.locale,
    })
  }

  const locale = args.locale === "en" ? "en" : "fr"
  const countryName = expansionCountryLabel(args.countryIso2, locale)
  const shopUrl = resolveGraduatedBuyerShopUrl(args.countryIso2)

  if (args.kind === "followup") {
    return render(
      CheckoutCountryLaunchFollowupEmail({
        countryName,
        shopUrl,
        locale,
      })
    )
  }

  return render(
    CheckoutCountryGraduatedEmail({
      countryName,
      shopUrl,
      locale,
    })
  )
}
