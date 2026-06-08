import { render } from "@react-email/render"
import { Resend } from "resend"

import { BookingCancellationEmail } from "@/emails/booking-cancellation"
import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"
import type { AppLocale } from "@/lib/i18n-locale"

const COPY: Record<
  AppLocale,
  {
    preview: string
    heading: string
    intro: string
    whenLabel: string
    seatsLabel: string
    refundLabel: string
    footer: string
    subject: (productName: string) => string
  }
> = {
  fr: {
    preview: "Votre réservation a été annulée",
    heading: "Réservation annulée",
    intro: "Votre annulation a bien été prise en compte. Le remboursement Stripe est en cours (5–10 jours ouvrés).",
    whenLabel: "Créneau annulé",
    seatsLabel: "Places",
    refundLabel: "Remboursement initié sur votre moyen de paiement d'origine.",
    footer: "Des questions ? Répondez à cet e-mail ou consultez vos commandes sur Affisell.",
    subject: (n) => `Annulation · ${n}`,
  },
  en: {
    preview: "Your booking was cancelled",
    heading: "Booking cancelled",
    intro: "Your cancellation is confirmed. Stripe refund is processing (5–10 business days).",
    whenLabel: "Cancelled slot",
    seatsLabel: "Seats",
    refundLabel: "Refund initiated to your original payment method.",
    footer: "Questions? Reply to this email or check your orders on Affisell.",
    subject: (n) => `Cancelled · ${n}`,
  },
  de: {
    preview: "Ihre Buchung wurde storniert",
    heading: "Buchung storniert",
    intro: "Ihre Stornierung ist bestätigt. Die Stripe-Erstattung wird bearbeitet (5–10 Werktage).",
    whenLabel: "Stornierter Termin",
    seatsLabel: "Plätze",
    refundLabel: "Erstattung an Ihre ursprüngliche Zahlungsmethode eingeleitet.",
    footer: "Fragen? Antworten Sie auf diese E-Mail.",
    subject: (n) => `Storniert · ${n}`,
  },
  es: {
    preview: "Your booking was cancelled",
    heading: "Booking cancelled",
    intro: "Your cancellation is confirmed. Refund is processing.",
    whenLabel: "Cancelled slot",
    seatsLabel: "Seats",
    refundLabel: "Refund initiated.",
    footer: "Questions? Reply to this email.",
    subject: (n) => `Cancelled · ${n}`,
  },
  it: {
    preview: "Your booking was cancelled",
    heading: "Booking cancelled",
    intro: "Your cancellation is confirmed.",
    whenLabel: "Cancelled slot",
    seatsLabel: "Seats",
    refundLabel: "Refund initiated.",
    footer: "Questions? Reply to this email.",
    subject: (n) => `Cancelled · ${n}`,
  },
  nl: {
    preview: "Your booking was cancelled",
    heading: "Booking cancelled",
    intro: "Your cancellation is confirmed.",
    whenLabel: "Cancelled slot",
    seatsLabel: "Seats",
    refundLabel: "Refund initiated.",
    footer: "Questions? Reply to this email.",
    subject: (n) => `Cancelled · ${n}`,
  },
  pl: {
    preview: "Your booking was cancelled",
    heading: "Booking cancelled",
    intro: "Your cancellation is confirmed.",
    whenLabel: "Cancelled slot",
    seatsLabel: "Seats",
    refundLabel: "Refund initiated.",
    footer: "Questions? Reply to this email.",
    subject: (n) => `Cancelled · ${n}`,
  },
  zh: {
    preview: "Your booking was cancelled",
    heading: "Booking cancelled",
    intro: "Your cancellation is confirmed.",
    whenLabel: "Cancelled slot",
    seatsLabel: "Seats",
    refundLabel: "Refund initiated.",
    footer: "Questions? Reply to this email.",
    subject: (n) => `Cancelled · ${n}`,
  },
}

function formatStartsAt(iso: string, locale: AppLocale): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString(locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  })
}

export async function sendBookingCancellationEmail(args: {
  orderId: string
  productName: string
  customerEmail: string
  bookingSnapshot: unknown
  buyerLocale?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[booking]", { orderId: args.orderId, result: "cancel_email_skipped_no_resend" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const snapshot = parseBookingSnapshot(args.bookingSnapshot)
  if (!snapshot) {
    return { ok: false, error: "missing_snapshot" }
  }

  const locale = resolveEmailLocale(args.buyerLocale)
  const copyPack = COPY[locale] ?? COPY.en
  const seatLabels =
    snapshot.seatLabels.length > 0 ? snapshot.seatLabels.join(", ") : null

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("booking-cancellation", args.customerEmail, config)

  try {
    const html = await render(
      BookingCancellationEmail({
        productName: args.productName,
        startsAtLabel: formatStartsAt(snapshot.startsAt, locale),
        seatLabels,
        copy: copyPack,
      })
    )
    await resend.emails.send({
      from: config.from,
      to,
      subject: copyPack.subject(args.productName),
      html,
    })
    console.log("[booking]", { orderId: args.orderId, result: "cancel_email_sent" })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[booking]", { orderId: args.orderId, result: "cancel_email_failed", message })
    return { ok: false, error: message }
  }
}
