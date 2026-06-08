import { isExperienceListingKind } from "@/lib/booking/types"
import type { AppLocale } from "@/lib/i18n-locale"

export type SupplierBookingAlertCopy = {
  preview: string
  heading: string
  intro: string
  whenLabel: string
  seatsLabel: string
  buyerLabel: string
  cta: string
  footer: string
  subject: (productName: string) => string
}

export type SupplierBookingDigestCopy = {
  preview: string
  heading: string
  intro: string
  cta: string
  footer: string
  guestLabel: string
  seatsLabel: string
  subject: (count: number, dateLabel: string) => string
}

function alertServiceFr(): SupplierBookingAlertCopy {
  return {
    preview: "Nouveau rendez-vous confirmé",
    heading: "Réservation confirmée",
    intro: "Un client vient de réserver — préparez l'accueil et le check-in.",
    whenLabel: "Date & heure",
    seatsLabel: "Places",
    buyerLabel: "Client",
    cta: "Ouvrir la liste invités",
    footer: "Scannez le QR du passe acheteur depuis votre dashboard.",
    subject: (n) => `Réservation · ${n}`,
  }
}

function alertExperienceFr(): SupplierBookingAlertCopy {
  return {
    preview: "Nouvelle séance réservée",
    heading: "Billets confirmés",
    intro: "De nouvelles places viennent d'être vendues — consultez la liste pour le check-in.",
    whenLabel: "Séance",
    seatsLabel: "Sièges",
    buyerLabel: "Acheteur",
    cta: "Ouvrir la liste invités",
    footer: "Export CSV et scan caméra disponibles sur votre dashboard.",
    subject: (n) => `Séance · ${n}`,
  }
}

function alertServiceEn(): SupplierBookingAlertCopy {
  return {
    preview: "New appointment confirmed",
    heading: "Booking confirmed",
    intro: "A buyer just booked — get ready for check-in.",
    whenLabel: "Date & time",
    seatsLabel: "Seats",
    buyerLabel: "Buyer",
    cta: "Open guest roster",
    footer: "Scan the buyer pass QR from your dashboard.",
    subject: (n) => `Booking · ${n}`,
  }
}

function alertExperienceEn(): SupplierBookingAlertCopy {
  return {
    preview: "New screening tickets sold",
    heading: "Tickets confirmed",
    intro: "New seats were just sold — review your roster for check-in.",
    whenLabel: "Showtime",
    seatsLabel: "Seats",
    buyerLabel: "Buyer",
    cta: "Open guest roster",
    footer: "CSV export and camera scan are on your dashboard.",
    subject: (n) => `Screening · ${n}`,
  }
}

export function copyForSupplierBookingAlert(
  locale: AppLocale,
  listingKind: string
): SupplierBookingAlertCopy {
  const experience = isExperienceListingKind(listingKind)
  if (locale === "fr") return experience ? alertExperienceFr() : alertServiceFr()
  return experience ? alertExperienceEn() : alertServiceEn()
}

export function copyForSupplierBookingDigest(locale: AppLocale): SupplierBookingDigestCopy {
  if (locale === "fr") {
    return {
      preview: "Vos réservations du jour",
      heading: "Agenda du jour",
      intro: "Voici les invités attendus aujourd'hui — check-in depuis votre dashboard.",
      cta: "Ouvrir check-in",
      footer: "Rappel automatique Affisell — zéro export manuel.",
      guestLabel: "Invité",
      seatsLabel: "Places",
      subject: (count, dateLabel) => `${count} réservation(s) · ${dateLabel}`,
    }
  }
  return {
    preview: "Today's bookings",
    heading: "Today's agenda",
    intro: "Guests expected today — check them in from your dashboard.",
    cta: "Open check-in",
    footer: "Affisell automatic reminder — no manual export.",
    guestLabel: "Guest",
    seatsLabel: "Seats",
    subject: (count, dateLabel) => `${count} booking(s) · ${dateLabel}`,
  }
}
