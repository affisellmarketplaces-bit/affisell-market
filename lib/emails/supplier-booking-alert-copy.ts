import { bookingVerticalCopyFamily, type BookingVerticalCopyFamily } from "@/lib/booking/vertical-copy"
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

function alertFr(family: BookingVerticalCopyFamily): SupplierBookingAlertCopy {
  if (family === "restaurant") {
    return {
      preview: "Nouvelle réservation restaurant",
      heading: "Table réservée",
      intro: "Un client vient de réserver — préparez l'accueil et le check-in.",
      whenLabel: "Service",
      seatsLabel: "Couverts",
      buyerLabel: "Client",
      cta: "Ouvrir la liste invités",
      footer: "Scannez le QR du passe acheteur depuis votre dashboard.",
      subject: (n) => `Réservation · ${n}`,
    }
  }
  if (family === "museum") {
    return {
      preview: "Nouvelle visite réservée",
      heading: "Entrée confirmée",
      intro: "De nouveaux billets viennent d'être vendus — consultez la liste pour le check-in.",
      whenLabel: "Créneau",
      seatsLabel: "Billets",
      buyerLabel: "Visiteur",
      cta: "Ouvrir la liste invités",
      footer: "Export CSV et scan caméra disponibles sur votre dashboard.",
      subject: (n) => `Visite · ${n}`,
    }
  }
  if (family === "experience") {
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

function alertEn(family: BookingVerticalCopyFamily): SupplierBookingAlertCopy {
  if (family === "restaurant") {
    return {
      preview: "New restaurant reservation",
      heading: "Table booked",
      intro: "A guest just booked — get ready for check-in.",
      whenLabel: "Service",
      seatsLabel: "Covers",
      buyerLabel: "Guest",
      cta: "Open guest roster",
      footer: "Scan the buyer pass QR from your dashboard.",
      subject: (n) => `Reservation · ${n}`,
    }
  }
  if (family === "museum") {
    return {
      preview: "New museum visit booked",
      heading: "Entry confirmed",
      intro: "New tickets were just sold — review your roster for check-in.",
      whenLabel: "Entry slot",
      seatsLabel: "Tickets",
      buyerLabel: "Visitor",
      cta: "Open guest roster",
      footer: "CSV export and camera scan are on your dashboard.",
      subject: (n) => `Visit · ${n}`,
    }
  }
  if (family === "experience") {
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

export function copyForSupplierBookingAlert(
  locale: AppLocale,
  listingKind: string
): SupplierBookingAlertCopy {
  const family = bookingVerticalCopyFamily(listingKind)
  if (locale === "fr") return alertFr(family)
  return alertEn(family)
}

function digestFr(family: BookingVerticalCopyFamily | "mixed"): SupplierBookingDigestCopy {
  if (family === "restaurant") {
    return {
      preview: "Vos tables du jour",
      heading: "Service du jour",
      intro: "Voici les clients attendus aujourd'hui — check-in à l'accueil depuis votre dashboard.",
      cta: "Ouvrir check-in",
      footer: "Rappel automatique Affisell — zéro export manuel.",
      guestLabel: "Client",
      seatsLabel: "Couverts",
      subject: (count, dateLabel) => `${count} table(s) · ${dateLabel}`,
    }
  }
  if (family === "museum") {
    return {
      preview: "Vos visites du jour",
      heading: "Entrées du jour",
      intro: "Voici les visiteurs attendus aujourd'hui — check-in à l'entrée depuis votre dashboard.",
      cta: "Ouvrir check-in",
      footer: "Rappel automatique Affisell — zéro export manuel.",
      guestLabel: "Visiteur",
      seatsLabel: "Billets",
      subject: (count, dateLabel) => `${count} visite(s) · ${dateLabel}`,
    }
  }
  if (family === "experience") {
    return {
      preview: "Vos séances du jour",
      heading: "Programme du jour",
      intro: "Voici les spectateurs attendus aujourd'hui — check-in depuis votre dashboard.",
      cta: "Ouvrir check-in",
      footer: "Rappel automatique Affisell — zéro export manuel.",
      guestLabel: "Acheteur",
      seatsLabel: "Sièges",
      subject: (count, dateLabel) => `${count} séance(s) · ${dateLabel}`,
    }
  }
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

function digestEn(family: BookingVerticalCopyFamily | "mixed"): SupplierBookingDigestCopy {
  if (family === "restaurant") {
    return {
      preview: "Today's tables",
      heading: "Today's service",
      intro: "Guests expected today — check them in at the host stand from your dashboard.",
      cta: "Open check-in",
      footer: "Affisell automatic reminder — no manual export.",
      guestLabel: "Guest",
      seatsLabel: "Covers",
      subject: (count, dateLabel) => `${count} table(s) · ${dateLabel}`,
    }
  }
  if (family === "museum") {
    return {
      preview: "Today's visits",
      heading: "Today's entries",
      intro: "Visitors expected today — check them in at the entrance from your dashboard.",
      cta: "Open check-in",
      footer: "Affisell automatic reminder — no manual export.",
      guestLabel: "Visitor",
      seatsLabel: "Tickets",
      subject: (count, dateLabel) => `${count} visit(s) · ${dateLabel}`,
    }
  }
  if (family === "experience") {
    return {
      preview: "Today's screenings",
      heading: "Today's schedule",
      intro: "Guests expected today — check them in from your dashboard.",
      cta: "Open check-in",
      footer: "Affisell automatic reminder — no manual export.",
      guestLabel: "Buyer",
      seatsLabel: "Seats",
      subject: (count, dateLabel) => `${count} screening(s) · ${dateLabel}`,
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

export function copyForSupplierBookingDigest(
  locale: AppLocale,
  listingKind?: string | null
): SupplierBookingDigestCopy {
  const family: BookingVerticalCopyFamily | "mixed" = listingKind
    ? bookingVerticalCopyFamily(listingKind)
    : "mixed"
  if (locale === "fr") return digestFr(family)
  return digestEn(family)
}
