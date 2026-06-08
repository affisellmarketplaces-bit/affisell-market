import {
  isExperienceListingKind,
  isMuseumListingKind,
  isRestaurantListingKind,
} from "@/lib/booking/types"
import type { AppLocale } from "@/lib/i18n-locale"

export type BookingPassEmailCopy = {
  preview: string
  heading: string
  intro: string
  cta: string
  whenLabel: string
  venueLabel: string
  footer: string
  subject: (productName: string) => string
}

const SERVICE: Record<AppLocale, BookingPassEmailCopy> = {
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
    intro: "Payment received — here is your Affisell pass. Show it at salon check-in.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email or visit your orders on Affisell.",
    subject: (n) => `Appointment · ${n}`,
  },
  de: {
    preview: "Ihr Termin ist bestätigt",
    heading: "Termin bestätigt",
    intro: "Zahlung erhalten — hier ist Ihr Affisell-Pass. Zeigen Sie ihn an der Rezeption.",
    cta: "Pass öffnen",
    whenLabel: "Datum & Uhrzeit",
    venueLabel: "Ort",
    footer: "Hilfe? Antworten Sie auf diese E-Mail oder öffnen Sie Ihre Bestellungen bei Affisell.",
    subject: (n) => `Termin · ${n}`,
  },
  es: {
    preview: "Tu cita está confirmada",
    heading: "Cita confirmada",
    intro: "Pago recibido — aquí está tu pase Affisell. Preséntalo en recepción.",
    cta: "Abrir mi pase",
    whenLabel: "Fecha y hora",
    venueLabel: "Lugar",
    footer: "¿Necesitas ayuda? Responde a este correo o visita tus pedidos en Affisell.",
    subject: (n) => `Cita · ${n}`,
  },
  it: {
    preview: "Il tuo appuntamento è confermato",
    heading: "Appuntamento confermato",
    intro: "Pagamento ricevuto — ecco il tuo pass Affisell. Mostralo alla reception.",
    cta: "Apri il mio pass",
    whenLabel: "Data e ora",
    venueLabel: "Luogo",
    footer: "Serve aiuto? Rispondi a questa email o visita i tuoi ordini su Affisell.",
    subject: (n) => `Appuntamento · ${n}`,
  },
  nl: {
    preview: "Je afspraak is bevestigd",
    heading: "Afspraak bevestigd",
    intro: "Betaling ontvangen — hier is je Affisell-pas. Toon deze bij de receptie.",
    cta: "Mijn pas openen",
    whenLabel: "Datum & tijd",
    venueLabel: "Locatie",
    footer: "Hulp nodig? Antwoord op deze e-mail of bekijk je bestellingen op Affisell.",
    subject: (n) => `Afspraak · ${n}`,
  },
  pl: {
    preview: "Twoja wizyta jest potwierdzona",
    heading: "Wizyta potwierdzona",
    intro: "Płatność otrzymana — oto Twój pass Affisell. Pokaż go przy recepcji.",
    cta: "Otwórz mój pass",
    whenLabel: "Data i godzina",
    venueLabel: "Miejsce",
    footer: "Potrzebujesz pomocy? Odpowiedz na ten e-mail lub sprawdź zamówienia w Affisell.",
    subject: (n) => `Wizyta · ${n}`,
  },
  zh: {
    preview: "您的预约已确认",
    heading: "预约已确认",
    intro: "付款成功 — 这是您的 Affisell 通行证。请在接待处出示。",
    cta: "打开通行证",
    whenLabel: "日期与时间",
    venueLabel: "地点",
    footer: "需要帮助？回复此邮件或在 Affisell 查看订单。",
    subject: (n) => `预约 · ${n}`,
  },
}

const EXPERIENCE: Record<AppLocale, BookingPassEmailCopy> = {
  fr: {
    preview: "Vos billets sont confirmés",
    heading: "Séance confirmée",
    intro: "Paiement validé — voici votre passe QR. Présentez-le à l'entrée du cinéma ou de l'événement.",
    cta: "Ouvrir mon passe",
    whenLabel: "Date & heure",
    venueLabel: "Lieu",
    footer: "Besoin d'aide ? Répondez à cet e-mail ou consultez vos commandes sur Affisell.",
    subject: (n) => `Séance · ${n}`,
  },
  en: {
    preview: "Your tickets are confirmed",
    heading: "Screening confirmed",
    intro: "Payment received — here is your QR pass. Show it at the cinema or event entrance.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Venue",
    footer: "Need help? Reply to this email or visit your orders on Affisell.",
    subject: (n) => `Screening · ${n}`,
  },
  de: {
    preview: "Ihre Tickets sind bestätigt",
    heading: "Vorstellung bestätigt",
    intro: "Zahlung erhalten — hier ist Ihr QR-Pass. Zeigen Sie ihn am Kinosaal- oder Event-Eingang.",
    cta: "Pass öffnen",
    whenLabel: "Datum & Uhrzeit",
    venueLabel: "Ort",
    footer: "Hilfe? Antworten Sie auf diese E-Mail oder öffnen Sie Ihre Bestellungen bei Affisell.",
    subject: (n) => `Vorstellung · ${n}`,
  },
  es: {
    preview: "Tus entradas están confirmadas",
    heading: "Sesión confirmada",
    intro: "Pago recibido — aquí está tu pase QR. Preséntalo en la entrada del cine o evento.",
    cta: "Abrir mi pase",
    whenLabel: "Fecha y hora",
    venueLabel: "Lugar",
    footer: "¿Necesitas ayuda? Responde a este correo o visita tus pedidos en Affisell.",
    subject: (n) => `Sesión · ${n}`,
  },
  it: {
    preview: "I tuoi biglietti sono confermati",
    heading: "Spettacolo confermato",
    intro: "Pagamento ricevuto — ecco il tuo pass QR. Mostralo all'ingresso del cinema o evento.",
    cta: "Apri il mio pass",
    whenLabel: "Data e ora",
    venueLabel: "Luogo",
    footer: "Serve aiuto? Rispondi a questa email o visita i tuoi ordini su Affisell.",
    subject: (n) => `Spettacolo · ${n}`,
  },
  nl: {
    preview: "Je tickets zijn bevestigd",
    heading: "Voorstelling bevestigd",
    intro: "Betaling ontvangen — hier is je QR-pas. Toon deze bij de ingang van de bioscoop of het evenement.",
    cta: "Mijn pas openen",
    whenLabel: "Datum & tijd",
    venueLabel: "Locatie",
    footer: "Hulp nodig? Antwoord op deze e-mail of bekijk je bestellingen op Affisell.",
    subject: (n) => `Voorstelling · ${n}`,
  },
  pl: {
    preview: "Twoje bilety są potwierdzone",
    heading: "Seans potwierdzony",
    intro: "Płatność otrzymana — oto Twój pass QR. Pokaż go przy wejściu do kina lub wydarzenia.",
    cta: "Otwórz mój pass",
    whenLabel: "Data i godzina",
    venueLabel: "Miejsce",
    footer: "Potrzebujesz pomocy? Odpowiedz na ten e-mail lub sprawdź zamówienia w Affisell.",
    subject: (n) => `Seans · ${n}`,
  },
  zh: {
    preview: "您的门票已确认",
    heading: "场次已确认",
    intro: "付款成功 — 这是您的二维码通行证。请在影院或活动入口出示。",
    cta: "打开通行证",
    whenLabel: "日期与时间",
    venueLabel: "地点",
    footer: "需要帮助？回复此邮件或在 Affisell 查看订单。",
    subject: (n) => `场次 · ${n}`,
  },
}

const RESTAURANT: Record<AppLocale, BookingPassEmailCopy> = {
  fr: {
    preview: "Votre table est réservée",
    heading: "Réservation confirmée",
    intro: "Paiement validé — voici votre passe QR. Présentez-le à l'accueil du restaurant.",
    cta: "Ouvrir mon passe",
    whenLabel: "Date & heure",
    venueLabel: "Restaurant",
    footer: "Besoin d'aide ? Répondez à cet e-mail ou consultez vos commandes sur Affisell.",
    subject: (n) => `Réservation · ${n}`,
  },
  en: {
    preview: "Your table is reserved",
    heading: "Reservation confirmed",
    intro: "Payment received — here is your QR pass. Show it at the restaurant host stand.",
    cta: "Open my pass",
    whenLabel: "Date & time",
    venueLabel: "Restaurant",
    footer: "Need help? Reply to this email or visit your orders on Affisell.",
    subject: (n) => `Reservation · ${n}`,
  },
  de: EXPERIENCE.de,
  es: EXPERIENCE.es,
  it: EXPERIENCE.it,
  nl: EXPERIENCE.nl,
  pl: EXPERIENCE.pl,
  zh: EXPERIENCE.zh,
}

const MUSEUM: Record<AppLocale, BookingPassEmailCopy> = {
  fr: {
    preview: "Votre entrée est confirmée",
    heading: "Visite confirmée",
    intro: "Paiement validé — voici votre passe QR. Présentez-le à l'entrée du musée.",
    cta: "Ouvrir mon passe",
    whenLabel: "Créneau d'entrée",
    venueLabel: "Musée",
    footer: "Besoin d'aide ? Répondez à cet e-mail ou consultez vos commandes sur Affisell.",
    subject: (n) => `Visite · ${n}`,
  },
  en: {
    preview: "Your entry is confirmed",
    heading: "Visit confirmed",
    intro: "Payment received — here is your QR pass. Show it at the museum entrance.",
    cta: "Open my pass",
    whenLabel: "Entry slot",
    venueLabel: "Museum",
    footer: "Need help? Reply to this email or visit your orders on Affisell.",
    subject: (n) => `Visit · ${n}`,
  },
  de: EXPERIENCE.de,
  es: EXPERIENCE.es,
  it: EXPERIENCE.it,
  nl: EXPERIENCE.nl,
  pl: EXPERIENCE.pl,
  zh: EXPERIENCE.zh,
}

export function copyForBookingPassEmail(
  locale: AppLocale,
  listingKind: string
): BookingPassEmailCopy {
  const pack = isRestaurantListingKind(listingKind)
    ? RESTAURANT
    : isMuseumListingKind(listingKind)
      ? MUSEUM
      : isExperienceListingKind(listingKind)
        ? EXPERIENCE
        : SERVICE
  return pack[locale] ?? pack.en
}
