import { render } from "@react-email/render"

import { StoreNewsletterWelcomeEmail } from "@/emails/store-newsletter-welcome"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"

const COPY = {
  fr: {
    preview: "Vous êtes inscrit à la newsletter",
    heading: "Bienvenue dans la communauté",
    body: "Merci de vous être inscrit à {storeName}. Vous serez informé en premier des nouveautés, réassorts et offres exclusives.",
    cta: "Visiter la boutique",
    footer: "Vous recevez cet e-mail car vous vous êtes inscrit sur une boutique Affisell.",
    subject: "Bienvenue · {storeName}",
  },
  en: {
    preview: "You subscribed to the newsletter",
    heading: "Welcome to the community",
    body: "Thanks for subscribing to {storeName}. You'll hear first about new drops, restocks, and exclusive offers.",
    cta: "Visit the shop",
    footer: "You received this email because you subscribed on an Affisell storefront.",
    subject: "Welcome · {storeName}",
  },
} as const

export async function sendStoreNewsletterWelcomeEmail(args: {
  to: string
  storeName: string
  shopUrl: string
  locale?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.log("[store-newsletter]", { result: "welcome_skipped", reason: "no_resend" })
    return { ok: false, error: "resend_not_configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const lang = locale.startsWith("fr") ? "fr" : "en"
  const copy = COPY[lang]
  const storeName = args.storeName.trim() || "the shop"

  const html = await render(
    StoreNewsletterWelcomeEmail({
      storeName,
      shopUrl: args.shopUrl,
      copy,
    })
  )

  const sent = await sendResendEmail({
    context: "store-newsletter-welcome",
    config,
    intendedTo: args.to,
    subject: copy.subject.replace("{storeName}", storeName),
    html,
  })

  if (!sent.ok) {
    console.error("[store-newsletter]", { result: "welcome_send_failed", error: sent.error })
    return { ok: false, error: sent.error }
  }

  console.log("[store-newsletter]", { result: "welcome_sent", resendId: sent.resendId })
  return { ok: true }
}
