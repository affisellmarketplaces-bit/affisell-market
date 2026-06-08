import { render } from "@react-email/render"

import { BookingWaitlistEmail } from "@/emails/booking-waitlist"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import {
  isExperienceListingKind,
  isMuseumListingKind,
  isRestaurantListingKind,
} from "@/lib/booking/types"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"

type WaitlistCopy = {
  preview: string
  heading: string
  intro: string
  cta: string
  footer: string
  subject: (productName: string) => string
}

function copyFor(locale: "fr" | "en", listingKind: string): WaitlistCopy {
  const restaurant = isRestaurantListingKind(listingKind)
  const museum = isMuseumListingKind(listingKind)
  const experience = isExperienceListingKind(listingKind)
  if (locale === "fr") {
    if (restaurant) {
      return {
        preview: "Une table s'est libérée",
        heading: "Table disponible",
        intro: "Bonne nouvelle — une table vient de se libérer pour ce service. Réservez vite.",
        cta: "Réserver maintenant",
        footer: "Lien personnel — ne partagez pas publiquement.",
        subject: (n) => `Table libre · ${n}`,
      }
    }
    if (museum) {
      return {
        preview: "Des places d'entrée se sont libérées",
        heading: "Créneau disponible",
        intro: "Bonne nouvelle — des places viennent de se libérer pour cette visite.",
        cta: "Réserver maintenant",
        footer: "Lien personnel — ne partagez pas publiquement.",
        subject: (n) => `Entrée libre · ${n}`,
      }
    }
    return experience
      ? {
          preview: "Des places se sont libérées",
          heading: "Places disponibles",
          intro: "Bonne nouvelle — des places viennent de se libérer pour cette séance. Réservez avant qu'il n'y en ait plus.",
          cta: "Réserver maintenant",
          footer: "Lien personnel — ne partagez pas publiquement.",
          subject: (n) => `Places libres · ${n}`,
        }
      : {
          preview: "Un créneau s'est libéré",
          heading: "Créneau disponible",
          intro: "Bonne nouvelle — le créneau que vous suiviez est à nouveau disponible.",
          cta: "Réserver maintenant",
          footer: "Lien personnel — ne partagez pas publiquement.",
          subject: (n) => `Créneau libre · ${n}`,
        }
  }
  if (restaurant) {
    return {
      preview: "A table just opened up",
      heading: "Table available",
      intro: "Good news — a table just opened for this service. Book before it's gone.",
      cta: "Book now",
      footer: "Personal link — do not share publicly.",
      subject: (n) => `Table available · ${n}`,
    }
  }
  if (museum) {
    return {
      preview: "Entry slots just opened",
      heading: "Entry available",
      intro: "Good news — entry slots just opened for this visit. Book before they're gone.",
      cta: "Book now",
      footer: "Personal link — do not share publicly.",
      subject: (n) => `Entry available · ${n}`,
    }
  }
  return experience
    ? {
        preview: "Seats just opened up",
        heading: "Seats available",
        intro: "Good news — seats just opened for this screening. Book before they are gone.",
        cta: "Book now",
        footer: "Personal link — do not share publicly.",
        subject: (n) => `Seats available · ${n}`,
      }
    : {
        preview: "A slot just opened",
        heading: "Slot available",
        intro: "Good news — the slot you were watching is available again.",
        cta: "Book now",
        footer: "Personal link — do not share publicly.",
        subject: (n) => `Slot available · ${n}`,
      }
}

function formatWhen(iso: string, locale: "fr" | "en"): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  })
}

export async function sendBookingWaitlistAvailableEmail(args: {
  waitlistId: string
  email: string
  productName: string
  listingKind: string
  slotStartsAt: string
  slotLabel: string | null
  affiliateProductId: string
  slotId: string
  locale?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = resolveEmailLocale(args.locale) === "fr" ? "fr" : "en"
  const copy = copyFor(locale, args.listingKind)
  const base = resolveAppUrl()
  const bookUrl = `${base}/marketplace/${args.affiliateProductId}?bookingSlotId=${encodeURIComponent(args.slotId)}`

  const { to } = resolveResendDeliveryRecipient("booking-waitlist", args.email, config)

  try {
    const html = await render(
      BookingWaitlistEmail({
        productName: args.productName,
        startsAtLabel: formatWhen(args.slotStartsAt, locale),
        slotLabel: args.slotLabel,
        bookUrl,
        copy,
      })
    )
    const { Resend } = await import("resend")
    const resend = new Resend(config.apiKey)
    await resend.emails.send({
      from: config.from,
      to,
      subject: copy.subject(args.productName),
      html,
    })
    console.log("[booking-waitlist]", {
      waitlistId: args.waitlistId,
      result: "email_sent",
      slotId: args.slotId,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[booking-waitlist]", {
      waitlistId: args.waitlistId,
      result: "email_failed",
      message,
    })
    return { ok: false, error: message }
  }
}
