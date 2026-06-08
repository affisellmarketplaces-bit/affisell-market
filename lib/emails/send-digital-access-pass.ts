import { render } from "@react-email/render"
import { Resend } from "resend"

import { DigitalAccessPassEmail } from "@/emails/digital-access-pass"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"

const COPY: Record<
  AppLocale,
  {
    preview: string
    heading: string
    intro: string
    cta: string
    instructionsLabel: string
    footer: string
    subject: (productName: string) => string
  }
> = {
  fr: {
    preview: "Votre accès digital est prêt",
    heading: "Votre formation est débloquée",
    intro: "Paiement confirmé — voici votre passe d'accès instantané. Conservez cet e-mail.",
    cta: "Ouvrir mon accès",
    instructionsLabel: "Instructions du formateur",
    footer: "Besoin d'aide ? Répondez à cet e-mail ou consultez vos commandes sur Affisell.",
    subject: (n) => `Accès digital · ${n}`,
  },
  en: {
    preview: "Your digital access is ready",
    heading: "Your course is unlocked",
    intro: "Payment confirmed — here is your instant access pass. Save this email.",
    cta: "Open my access",
    instructionsLabel: "Creator instructions",
    footer: "Need help? Reply to this email or visit your orders on Affisell.",
    subject: (n) => `Digital access · ${n}`,
  },
  de: {
    preview: "Ihr Digitalzugang ist bereit",
    heading: "Ihr Kurs ist freigeschaltet",
    intro: "Zahlung bestätigt — hier ist Ihr Sofort-Zugangspass. Bewahren Sie diese E-Mail auf.",
    cta: "Zugang öffnen",
    instructionsLabel: "Anleitung des Anbieters",
    footer: "Hilfe? Antworten Sie auf diese E-Mail oder öffnen Sie Ihre Bestellungen bei Affisell.",
    subject: (n) => `Digitalzugang · ${n}`,
  },
  es: {
    preview: "Your digital access is ready",
    heading: "Your course is unlocked",
    intro: "Payment confirmed — here is your instant access pass.",
    cta: "Open my access",
    instructionsLabel: "Instructions",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Digital access · ${n}`,
  },
  it: {
    preview: "Your digital access is ready",
    heading: "Your course is unlocked",
    intro: "Payment confirmed — here is your instant access pass.",
    cta: "Open my access",
    instructionsLabel: "Instructions",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Digital access · ${n}`,
  },
  nl: {
    preview: "Your digital access is ready",
    heading: "Your course is unlocked",
    intro: "Payment confirmed — here is your instant access pass.",
    cta: "Open my access",
    instructionsLabel: "Instructions",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Digital access · ${n}`,
  },
  pl: {
    preview: "Your digital access is ready",
    heading: "Your course is unlocked",
    intro: "Payment confirmed — here is your instant access pass.",
    cta: "Open my access",
    instructionsLabel: "Instructions",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Digital access · ${n}`,
  },
  zh: {
    preview: "Your digital access is ready",
    heading: "Your course is unlocked",
    intro: "Payment confirmed — here is your instant access pass.",
    cta: "Open my access",
    instructionsLabel: "Instructions",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Digital access · ${n}`,
  },
}

export async function sendDigitalAccessPassEmail(args: {
  orderId: string
  productName: string
  customerEmail: string
  passPath: string
  accessUrl: string
  instructions: string | null
  locale?: AppLocale | string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[digital-delivery]", { orderId: args.orderId, result: "email_skipped_no_resend" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const copyPack = COPY[locale] ?? COPY.en
  const base = resolveAppUrl()
  const passUrl = `${base}${args.passPath.startsWith("/") ? args.passPath : `/${args.passPath}`}`

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("digital-access-pass", args.customerEmail, config)

  try {
    const html = await render(
      DigitalAccessPassEmail({
        productName: args.productName,
        passUrl,
        accessUrl: args.accessUrl,
        instructions: args.instructions,
        copy: copyPack,
      })
    )
    await resend.emails.send({
      from: config.from,
      to,
      subject: copyPack.subject(args.productName),
      html,
    })
    console.log("[digital-delivery]", { orderId: args.orderId, result: "email_sent" })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[digital-delivery]", { orderId: args.orderId, result: "email_failed", message })
    return { ok: false, error: message }
  }
}
