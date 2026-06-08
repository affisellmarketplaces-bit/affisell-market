import {
  isExperienceListingKind,
  isMuseumListingKind,
  isRestaurantListingKind,
} from "@/lib/booking/types"

export type BookingVerticalCopyFamily = "service" | "experience" | "restaurant" | "museum"

export function bookingVerticalCopyFamily(kind: string | null | undefined): BookingVerticalCopyFamily {
  if (isRestaurantListingKind(kind)) return "restaurant"
  if (isMuseumListingKind(kind)) return "museum"
  if (isExperienceListingKind(kind)) return "experience"
  return "service"
}

/** J-0 digest uses vertical copy only when every row shares the same family. */
export function resolveDigestListingKind(
  rows: ReadonlyArray<{ listingKind?: string | null }>
): string | null {
  if (rows.length === 0) return null
  const families = new Set(rows.map((row) => bookingVerticalCopyFamily(row.listingKind)))
  if (families.size !== 1) return null
  const kind = rows.find((row) => row.listingKind?.trim())?.listingKind?.trim()
  return kind ?? null
}

export type BuyerBookingOrderCardCopy = {
  title: string
  hint: string
  cta: string
  cancelCta: string
}

export function buyerBookingOrderCardCopy(
  listingKind: string | null | undefined,
  lang: "fr" | "en"
): BuyerBookingOrderCardCopy {
  const family = bookingVerticalCopyFamily(listingKind)
  if (lang === "fr") {
    if (family === "restaurant") {
      return {
        title: "Réservation confirmée",
        hint: "Votre passe est prêt — présentez-le à l'accueil du restaurant.",
        cta: "Ouvrir mon passe",
        cancelCta: "Annuler la réservation",
      }
    }
    if (family === "museum") {
      return {
        title: "Visite confirmée",
        hint: "Votre passe est prêt — présentez-le à l'entrée du musée.",
        cta: "Ouvrir mon passe",
        cancelCta: "Annuler la visite",
      }
    }
    if (family === "experience") {
      return {
        title: "Séance confirmée",
        hint: "Votre passe est prêt — présentez-le à l'entrée du cinéma ou de l'événement.",
        cta: "Ouvrir mon passe",
        cancelCta: "Annuler la séance",
      }
    }
    return {
      title: "Rendez-vous confirmé",
      hint: "Votre passe est prêt — présentez-le à l'accueil du salon.",
      cta: "Ouvrir mon passe",
      cancelCta: "Annuler le rendez-vous",
    }
  }

  if (family === "restaurant") {
    return {
      title: "Reservation confirmed",
      hint: "Your pass is ready — show it at the restaurant host stand.",
      cta: "Open my pass",
      cancelCta: "Cancel reservation",
    }
  }
  if (family === "museum") {
    return {
      title: "Visit confirmed",
      hint: "Your pass is ready — show it at the museum entrance.",
      cta: "Open my pass",
      cancelCta: "Cancel visit",
    }
  }
  if (family === "experience") {
    return {
      title: "Screening confirmed",
      hint: "Your pass is ready — show it at the cinema or event entrance.",
      cta: "Open my pass",
      cancelCta: "Cancel screening",
    }
  }
  return {
    title: "Appointment confirmed",
    hint: "Your pass is ready — show it at salon check-in.",
    cta: "Open my pass",
    cancelCta: "Cancel appointment",
  }
}
