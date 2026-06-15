import { render } from "@react-email/render"

import { CheckoutCountryLaunchEmail } from "@/emails/checkout-country-launch"
import { expansionCountryLabel } from "@/lib/expansion/expansion-country-label"
import { resolveGraduatedBuyerShopUrl } from "@/lib/expansion/graduated-buyer-shop-url"

export async function renderCheckoutCountryLaunchEmailHtml(args: {
  countryIso2: string
  locale?: "en" | "fr"
}): Promise<string> {
  const locale = args.locale === "en" ? "en" : "fr"
  const countryName = expansionCountryLabel(args.countryIso2, locale)
  const shopUrl = resolveGraduatedBuyerShopUrl(args.countryIso2)

  return render(
    CheckoutCountryLaunchEmail({
      countryName,
      shopUrl,
      locale,
    })
  )
}
