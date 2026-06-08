import { render } from "@react-email/render"
import { Resend } from "resend"

import { BookingReminderEmail } from "@/emails/booking-reminder"
import { bookingPassPath } from "@/lib/booking/pass-token"
import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import {
  bookingVerticalCopyFamily,
  type BookingVerticalCopyFamily,
} from "@/lib/booking/vertical-copy"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"

export type BookingReminderKind = "day" | "hour"

type CopyPack = {
  preview: string
  heading: string
  intro: string
  cta: string
  whenLabel: string
  venueLabel: string
  seatsLabel: string
  footer: string
  subject: (productName: string) => string
}

function dayCopy(fr: boolean, family: BookingVerticalCopyFamily): CopyPack {
  if (family === "restaurant") {
    return fr
      ? {
          preview: "Votre réservation est demain",
          heading: "Rappel réservation",
          intro: "Votre table est réservée demain. Ayez votre passe QR prêt à l'accueil.",
          cta: "Ouvrir mon passe",
          whenLabel: "Date & heure",
          venueLabel: "Restaurant",
          seatsLabel: "Couverts",
          footer: "Besoin d'annuler ? Consultez vos commandes sur Affisell.",
          subject: (n) => `Demain · ${n}`,
        }
      : {
          preview: "Your reservation is tomorrow",
          heading: "Reservation reminder",
          intro: "Your table is booked for tomorrow. Have your QR pass ready at the host stand.",
          cta: "Open my pass",
          whenLabel: "Date & time",
          venueLabel: "Restaurant",
          seatsLabel: "Covers",
          footer: "Need to cancel? Visit your orders on Affisell.",
          subject: (n) => `Tomorrow · ${n}`,
        }
  }
  if (family === "museum") {
    return fr
      ? {
          preview: "Votre visite est demain",
          heading: "Rappel visite",
          intro: "Votre créneau d'entrée est demain. Présentez votre passe QR à l'accueil.",
          cta: "Ouvrir mon passe",
          whenLabel: "Créneau",
          venueLabel: "Musée",
          seatsLabel: "Billets",
          footer: "Besoin d'annuler ? Consultez vos commandes sur Affisell.",
          subject: (n) => `Demain · ${n}`,
        }
      : {
          preview: "Your visit is tomorrow",
          heading: "Visit reminder",
          intro: "Your entry slot is tomorrow. Show your QR pass at the museum entrance.",
          cta: "Open my pass",
          whenLabel: "Entry slot",
          venueLabel: "Museum",
          seatsLabel: "Tickets",
          footer: "Need to cancel? Visit your orders on Affisell.",
          subject: (n) => `Tomorrow · ${n}`,
        }
  }
  if (family === "experience") {
    return fr
      ? {
          preview: "Votre séance approche — demain",
          heading: "Rappel séance",
          intro: "Votre séance est demain. Ouvrez votre passe QR pour l'entrée.",
          cta: "Ouvrir mon passe",
          whenLabel: "Date & heure",
          venueLabel: "Lieu",
          seatsLabel: "Places",
          footer: "Besoin d'annuler ? Consultez vos commandes sur Affisell.",
          subject: (n) => `Demain · ${n}`,
        }
      : {
          preview: "Your screening is tomorrow",
          heading: "Screening reminder",
          intro: "Your screening is tomorrow. Open your QR pass for entry.",
          cta: "Open my pass",
          whenLabel: "Date & time",
          venueLabel: "Venue",
          seatsLabel: "Seats",
          footer: "Need to cancel? Visit your orders on Affisell.",
          subject: (n) => `Tomorrow · ${n}`,
        }
  }
  return fr
    ? {
        preview: "Votre rendez-vous approche — demain",
        heading: "Rappel rendez-vous",
        intro: "Votre rendez-vous est demain. Présentez votre passe QR à l'accueil.",
        cta: "Ouvrir mon passe",
        whenLabel: "Date & heure",
        venueLabel: "Lieu",
        seatsLabel: "Places",
        footer: "Besoin d'annuler ? Consultez vos commandes sur Affisell.",
        subject: (n) => `Demain · ${n}`,
      }
    : {
        preview: "Your appointment is tomorrow",
        heading: "Appointment reminder",
        intro: "Your appointment is tomorrow. Show your QR pass at check-in.",
        cta: "Open my pass",
        whenLabel: "Date & time",
        venueLabel: "Venue",
        seatsLabel: "Seats",
        footer: "Need to cancel? Visit your orders on Affisell.",
        subject: (n) => `Tomorrow · ${n}`,
      }
}

function hourCopy(fr: boolean, family: BookingVerticalCopyFamily): CopyPack {
  if (family === "restaurant") {
    return fr
      ? {
          preview: "Votre table dans 2 heures",
          heading: "C'est bientôt l'heure",
          intro: "Votre service commence dans environ 2 heures. Ayez votre passe prêt.",
          cta: "Ouvrir mon passe",
          whenLabel: "Date & heure",
          venueLabel: "Restaurant",
          seatsLabel: "Couverts",
          footer: "Retrouvez votre passe via le bouton ci-dessus.",
          subject: (n) => `Dans 2 h · ${n}`,
        }
      : {
          preview: "Your table is in 2 hours",
          heading: "Starting soon",
          intro: "Your service starts in about 2 hours. Have your pass ready.",
          cta: "Open my pass",
          whenLabel: "Date & time",
          venueLabel: "Restaurant",
          seatsLabel: "Covers",
          footer: "Open your pass using the button above.",
          subject: (n) => `In 2 hours · ${n}`,
        }
  }
  if (family === "museum") {
    return fr
      ? {
          preview: "Votre visite dans 2 heures",
          heading: "C'est bientôt l'heure",
          intro: "Votre créneau d'entrée commence dans environ 2 heures. Ayez votre passe prêt.",
          cta: "Ouvrir mon passe",
          whenLabel: "Créneau",
          venueLabel: "Musée",
          seatsLabel: "Billets",
          footer: "Retrouvez votre passe via le bouton ci-dessus.",
          subject: (n) => `Dans 2 h · ${n}`,
        }
      : {
          preview: "Your visit starts in 2 hours",
          heading: "Starting soon",
          intro: "Your entry slot starts in about 2 hours. Have your QR pass ready.",
          cta: "Open my pass",
          whenLabel: "Entry slot",
          venueLabel: "Museum",
          seatsLabel: "Tickets",
          footer: "Open your pass using the button above.",
          subject: (n) => `In 2 hours · ${n}`,
        }
  }
  if (family === "experience") {
    return fr
      ? {
          preview: "Votre séance dans 2 heures",
          heading: "C'est bientôt l'heure",
          intro: "Votre séance commence dans environ 2 heures. Ayez votre passe QR prêt.",
          cta: "Ouvrir mon passe",
          whenLabel: "Date & heure",
          venueLabel: "Lieu",
          seatsLabel: "Places",
          footer: "Retrouvez l'accès à votre passe via le bouton ci-dessus.",
          subject: (n) => `Dans 2 h · ${n}`,
        }
      : {
          preview: "Your screening starts in 2 hours",
          heading: "Starting soon",
          intro: "Your screening starts in about 2 hours. Have your QR pass ready at the entrance.",
          cta: "Open my pass",
          whenLabel: "Date & time",
          venueLabel: "Venue",
          seatsLabel: "Seats",
          footer: "Open your pass using the button above.",
          subject: (n) => `In 2 hours · ${n}`,
        }
  }
  return fr
    ? {
        preview: "Votre rendez-vous dans 2 heures",
        heading: "C'est bientôt l'heure",
        intro: "Votre rendez-vous commence dans environ 2 heures. Présentez votre passe à l'accueil.",
        cta: "Ouvrir mon passe",
        whenLabel: "Date & heure",
        venueLabel: "Lieu",
        seatsLabel: "Places",
        footer: "Retrouvez votre passe via le bouton ci-dessus.",
        subject: (n) => `Dans 2 h · ${n}`,
      }
    : {
        preview: "Your appointment is in 2 hours",
        heading: "Starting soon",
        intro: "Your appointment starts in about 2 hours. Show your QR pass at check-in.",
        cta: "Open my pass",
        whenLabel: "Date & time",
        venueLabel: "Venue",
        seatsLabel: "Seats",
        footer: "Open your pass using the button above.",
        subject: (n) => `In 2 hours · ${n}`,
      }
}

function copyFor(
  locale: AppLocale,
  kind: BookingReminderKind,
  listingKind: string
): CopyPack {
  const family = bookingVerticalCopyFamily(listingKind)
  const fr = locale === "fr"
  return kind === "day" ? dayCopy(fr, family) : hourCopy(fr, family)
}

function formatStartsAtLabel(iso: string, locale: AppLocale): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const loc = locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-GB"
  return d.toLocaleString(loc, { dateStyle: "full", timeStyle: "short" })
}

export async function sendBookingReminderEmail(args: {
  orderId: string
  customerEmail: string
  productName: string
  bookingToken: string
  bookingSnapshot: unknown
  listingKind: string | null
  locale?: AppLocale | string | null
  kind: BookingReminderKind
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[booking-reminder]", { orderId: args.orderId, result: "email_skipped_no_resend" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const snapshot = parseBookingSnapshot(args.bookingSnapshot)
  const listingKind = args.listingKind ?? snapshot?.listingKind ?? "SERVICE"
  const copyPack = copyFor(locale, args.kind, listingKind)
  const startsAt = snapshot?.startsAt ?? new Date().toISOString()
  const base = resolveAppUrl()
  const passPath = bookingPassPath(args.bookingToken)
  const passUrl = `${base}${passPath}`

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("booking-reminder", args.customerEmail, config)

  try {
    const html = await render(
      BookingReminderEmail({
        productName: snapshot?.productName || args.productName,
        passUrl,
        startsAtLabel: formatStartsAtLabel(startsAt, locale),
        venueLabel: snapshot?.venueLabel ?? null,
        seatLabels: snapshot?.seatLabels ?? [],
        copy: copyPack,
      })
    )
    await resend.emails.send({
      from: config.from,
      to,
      subject: copyPack.subject(snapshot?.productName || args.productName),
      html,
    })
    console.log("[booking-reminder]", {
      orderId: args.orderId,
      kind: args.kind,
      result: "email_sent",
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[booking-reminder]", {
      orderId: args.orderId,
      kind: args.kind,
      result: "email_failed",
      message,
    })
    return { ok: false, error: message }
  }
}
