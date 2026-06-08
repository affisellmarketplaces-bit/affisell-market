import { render } from "@react-email/render"
import { Resend } from "resend"

import { BookingAccessPassEmail } from "@/emails/booking-access-pass"
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
    whenLabel: string
    venueLabel: string
    footer: string
    subject: (productName: string) => string
  }
> = {
  fr: {
    preview: "Votre rendez-vous est confirmé",
    heading: "Rendez-vous confirmé",
    intro: "Paiement validé — voici votre passe Affisell. Présentez-le à l'accueil du salon.",
    cta: "Ouvrir mon passe",
    whenLabel: "Date & heure",
    venueLabel: "Lieu",
    footer: "Besoin d'aide ? Répondez à cet e-mail ou consultez vos commandes sur Affisell.",
    subject: (n) => `Rendez-vous · ${n}`,
  },
  en: {
    preview: "Your appointment is confirmed",
    heading: "Appointment confirmed",
    intro: "Payment received — here is your Affisell pass. Show it at check-in.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email or visit your orders on Affisell.",
    subject: (n) => `Appointment · ${n}`,
  },
  de: {
    preview: "Ihr Termin ist bestätigt",
    heading: "Termin bestätigt",
    intro: "Zahlung erhalten — hier ist Ihr Affisell-Pass. Zeigen Sie ihn beim Check-in.",
    cta: "Pass öffnen",
    whenLabel: "Datum & Uhrzeit",
    venueLabel: "Ort",
    footer: "Hilfe? Antworten Sie auf diese E-Mail oder öffnen Sie Ihre Bestellungen bei Affisell.",
    subject: (n) => `Termin · ${n}`,
  },
  es: {
    preview: "Your appointment is confirmed",
    heading: "Appointment confirmed",
    intro: "Payment received — here is your Affisell pass.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Appointment · ${n}`,
  },
  it: {
    preview: "Your appointment is confirmed",
    heading: "Appointment confirmed",
    intro: "Payment received — here is your Affisell pass.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Appointment · ${n}`,
  },
  nl: {
    preview: "Your appointment is confirmed",
    heading: "Appointment confirmed",
    intro: "Payment received — here is your Affisell pass.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Appointment · ${n}`,
  },
  pl: {
    preview: "Your appointment is confirmed",
    heading: "Appointment confirmed",
    intro: "Payment received — here is your Affisell pass.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Appointment · ${n}`,
  },
  zh: {
    preview: "Your appointment is confirmed",
    heading: "Appointment confirmed",
    intro: "Payment received — here is your Affisell pass.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email.",
    subject: (n) => `Appointment · ${n}`,
  },
}

function formatStartsAtLabel(iso: string, locale: AppLocale): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString(locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  })
}

export async function sendBookingPassEmail(args: {
  orderId: string
  productName: string
  customerEmail: string
  passPath: string
  startsAt: string
  venueLabel: string | null
  locale?: AppLocale | string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[booking]", { orderId: args.orderId, result: "email_skipped_no_resend" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const copyPack = COPY[locale] ?? COPY.en
  const base = resolveAppUrl()
  const passUrl = `${base}${args.passPath.startsWith("/") ? args.passPath : `/${args.passPath}`}`

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("booking-access-pass", args.customerEmail, config)

  try {
    const html = await render(
      BookingAccessPassEmail({
        productName: args.productName,
        passUrl,
        startsAtLabel: formatStartsAtLabel(args.startsAt, locale),
        venueLabel: args.venueLabel,
        copy: copyPack,
      })
    )
    await resend.emails.send({
      from: config.from,
      to,
      subject: copyPack.subject(args.productName),
      html,
    })
    console.log("[booking]", { orderId: args.orderId, result: "email_sent" })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[booking]", { orderId: args.orderId, result: "email_failed", message })
    return { ok: false, error: message }
  }
}
