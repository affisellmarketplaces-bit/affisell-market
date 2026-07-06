import { render } from "@react-email/render"

import { StoreFlashSaleAlertEmail } from "@/emails/store-flash-sale-alert"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import {
  flashSaleShopUrlWithAnchor,
  formatFlashSaleEndsAtLabel,
} from "@/lib/store-flash-sale-newsletter.shared"
import type { FlashSaleConfig } from "@/lib/storefront-flash-sale-shared"
import { formatWishlistPriceEur } from "@/lib/wishlist-price-alert"

const COPY = {
  fr: {
    preview: "Vente flash en cours chez {storeName}",
    heading: "⚡ Vente flash",
    body: "Les offres limitées sont en ligne — ne tardez pas.",
    endsLabel: "Fin :",
    cta: "Voir la vente flash",
    footer: "Vous recevez cet e-mail car vous êtes inscrit à la newsletter de {storeName}.",
    subject: "⚡ Vente flash · {storeName}",
    defaultHeadline: "Offres limitées sur la boutique",
  },
  en: {
    preview: "Flash sale live at {storeName}",
    heading: "⚡ Flash sale",
    body: "Limited-time deals are live — don't wait.",
    endsLabel: "Ends:",
    cta: "Shop the flash sale",
    footer: "You received this email because you subscribed to {storeName}'s newsletter.",
    subject: "⚡ Flash sale · {storeName}",
    defaultHeadline: "Limited-time deals on the shop",
  },
} as const

export type FlashSaleAlertListing = {
  name: string
  priceCents: number
}

export async function sendStoreFlashSaleAlertEmail(args: {
  to: string
  storeName: string
  shopUrl: string
  config: FlashSaleConfig
  listings: FlashSaleAlertListing[]
  locale?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.log("[store-flash-sale-newsletter]", { result: "alert_skipped", reason: "no_resend" })
    return { ok: false, error: "resend_not_configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const lang = locale.startsWith("fr") ? "fr" : "en"
  const copy = COPY[lang]
  const storeName = args.storeName.trim() || (lang === "fr" ? "la boutique" : "the shop")
  const headline = args.config.title?.trim() || copy.defaultHeadline
  const endsAtLabel = formatFlashSaleEndsAtLabel(args.config.endsAt, lang)
  const shopUrl = flashSaleShopUrlWithAnchor(args.shopUrl)

  const products = args.listings.slice(0, 4).map((row) => ({
    name: row.name,
    priceLabel: formatWishlistPriceEur(row.priceCents),
  }))

  const html = await render(
    StoreFlashSaleAlertEmail({
      storeName,
      shopUrl,
      headline,
      endsAtLabel,
      products,
      copy,
    })
  )

  const sent = await sendResendEmail({
    context: "store-flash-sale-alert",
    config,
    intendedTo: args.to,
    subject: copy.subject.replace("{storeName}", storeName),
    html,
  })

  if (!sent.ok) {
    console.error("[store-flash-sale-newsletter]", { result: "alert_send_failed", error: sent.error })
    return { ok: false, error: sent.error }
  }

  console.log("[store-flash-sale-newsletter]", { result: "alert_sent", resendId: sent.resendId })
  return { ok: true }
}
