#!/usr/bin/env node
/**
 * Sync BookingPass + supplier.booking (+ nav.supplier.bookings) from en.json into other locales.
 * Usage: node scripts/i18n-sync-booking-phase8.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"))

function deepMergeMissing(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return target
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {}
      deepMergeMissing(target[key], value)
    } else if (target[key] === undefined) {
      target[key] = value
    }
  }
  return target
}

function deepAssign(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return target
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {}
      deepAssign(target[key], value)
    } else {
      target[key] = value
    }
  }
  return target
}

/** Locale-specific booking UI strings (not English fallback). */
const OVERRIDES = {
  de: {
    nav: { supplier: { bookings: "Reservierungen" } },
    BookingPass: {
      badge: "Affisell Booking Pass",
      title: "Reservierung bestätigt",
      titleService: "Termin bestätigt",
      titleExperience: "Tickets bestätigt",
      subtitle: "Zeigen Sie diesen Pass beim Check-in — persönlicher QR, nicht öffentlich teilen.",
      orderRef: "Bestellung {id}… · ×{qty}",
      seatsLabel: "Plätze",
      confirmedAt: "Bestätigt · {date}",
      myOrders: "Meine Bestellungen",
      qrAlt: "QR-Code Buchungspass",
    },
    supplier: {
      booking: {
        roster: {
          pageTitle: "Gästeliste & Check-in",
          pageDescription:
            "QR-Pass scannen oder einfügen. Sehen Sie, wer jeden Slot gebucht hat, und markieren Sie Ankünfte.",
          backToDashboard: "Zurück zur Übersicht",
          awaitingCheckIn: "{count} warten auf Check-in",
          checkInTitle: "Check-in-Scanner",
          checkInHint: "Scannen Sie den QR-Pass des Käufers oder fügen Sie die URL ein.",
          cameraScanCta: "QR scannen",
          cameraStopCta: "Kamera stoppen",
          cameraScanningHint: "QR-Code des Käuferpasses anvisieren",
          orCameraManual: "Oder Pass-URL manuell einfügen",
          cameraPermissionDenied: "Kamerazugriff verweigert — in den Browser-Einstellungen erlauben.",
          cameraUnavailable: "Kamera auf diesem Gerät nicht verfügbar",
          tokenPlaceholder: "Pass-URL oder Token…",
          checkInCta: "Eintritt bestätigen",
          checkInSuccess: "Gast eingecheckt",
          alreadyCheckedIn: "Bereits eingecheckt",
          checkInFailed: "Check-in fehlgeschlagen",
          invalidToken: "Ungültige Pass-URL oder Token",
          loadError: "Liste konnte nicht geladen werden",
          empty: "Keine Buchungen in diesem Zeitraum.",
          tabPending: "Wartend",
          tabCheckedIn: "Eingecheckt",
          tabAll: "Alle",
          allSlots: "Alle Slots",
          slotFilterLabel: "Nach Slot filtern",
          checkedInBadge: "Eingecheckt",
          checkInRow: "Als anwesend markieren",
          statsTotalGuests: "Gäste",
          statsCheckedIn: "Eingecheckt",
          statsPending: "Wartend",
          statsNoShow: "No-show",
          statsCheckInRate: "Check-in-Rate",
          exportCsv: "CSV exportieren",
          exportSuccess: "Liste exportiert",
          exportFailed: "Export fehlgeschlagen",
          errors: {
            invalid_token: "Ungültige Pass-URL oder Token",
            not_found: "Pass nicht gefunden",
            forbidden: "Dieser Pass gehört einem anderen Händler",
            not_confirmed: "Buchung noch nicht bestätigt",
            cancelled: "Buchung storniert",
            checkInFailed: "Check-in fehlgeschlagen",
          },
        },
      },
    },
  },
  es: {
    nav: { supplier: { bookings: "Reservas" } },
    BookingPass: {
      badge: "Pase Affisell Booking",
      title: "Reserva confirmada",
      titleService: "Cita confirmada",
      titleExperience: "Entradas confirmadas",
      subtitle: "Muestra este pase en recepción — QR personal, no compartir públicamente.",
      orderRef: "Pedido {id}… · ×{qty}",
      seatsLabel: "Asientos",
      confirmedAt: "Confirmado · {date}",
      myOrders: "Mis pedidos",
      qrAlt: "Código QR del pase",
    },
  },
  it: {
    nav: { supplier: { bookings: "Prenotazioni" } },
    BookingPass: {
      badge: "Pass Affisell Booking",
      title: "Prenotazione confermata",
      titleService: "Appuntamento confermato",
      titleExperience: "Biglietti confermati",
      subtitle: "Mostra questo pass al check-in — QR personale, non condividere pubblicamente.",
      orderRef: "Ordine {id}… · ×{qty}",
      seatsLabel: "Posti",
      confirmedAt: "Confermato · {date}",
      myOrders: "I miei ordini",
      qrAlt: "Codice QR del pass",
    },
  },
  nl: {
    nav: { supplier: { bookings: "Reserveringen" } },
    BookingPass: {
      badge: "Affisell Booking Pass",
      title: "Reservering bevestigd",
      titleService: "Afspraak bevestigd",
      titleExperience: "Tickets bevestigd",
      subtitle: "Toon deze pas bij check-in — persoonlijke QR, niet openbaar delen.",
      orderRef: "Bestelling {id}… · ×{qty}",
      seatsLabel: "Stoelen",
      confirmedAt: "Bevestigd · {date}",
      myOrders: "Mijn bestellingen",
      qrAlt: "QR-code reserveringspas",
    },
  },
  pl: {
    nav: { supplier: { bookings: "Rezerwacje" } },
    BookingPass: {
      badge: "Pass Affisell Booking",
      title: "Rezerwacja potwierdzona",
      titleService: "Wizyta potwierdzona",
      titleExperience: "Bilety potwierdzone",
      subtitle: "Pokaż ten pass przy check-in — osobisty QR, nie udostępniaj publicznie.",
      orderRef: "Zamówienie {id}… · ×{qty}",
      seatsLabel: "Miejsca",
      confirmedAt: "Potwierdzone · {date}",
      myOrders: "Moje zamówienia",
      qrAlt: "Kod QR passu",
    },
  },
  zh: {
    nav: { supplier: { bookings: "预订" } },
    BookingPass: {
      badge: "Affisell 预订通行证",
      title: "预订已确认",
      titleService: "预约已确认",
      titleExperience: "门票已确认",
      subtitle: "入场时出示此通行证 — 个人二维码，请勿公开分享。",
      orderRef: "订单 {id}… · ×{qty}",
      seatsLabel: "座位",
      confirmedAt: "已确认 · {date}",
      myOrders: "我的订单",
      qrAlt: "预订通行证二维码",
    },
  },
}

const locales = ["de", "es", "it", "nl", "pl", "zh"]

for (const locale of locales) {
  const file = path.join(root, "messages", `${locale}.json`)
  const target = JSON.parse(fs.readFileSync(file, "utf8"))

  deepMergeMissing(target, {
    nav: { supplier: { bookings: en.nav.supplier.bookings } },
    BookingPass: en.BookingPass,
    Product: { booking: en.Product.booking },
    supplier: {
      booking: en.supplier.booking,
      digitalDelivery: en.supplier.digitalDelivery,
    },
  })

  if (OVERRIDES[locale]) {
    deepAssign(target, OVERRIDES[locale])
  }

  fs.writeFileSync(file, `${JSON.stringify(target, null, 2)}\n`)
  console.log("[i18n-sync-booking]", { locale, result: "updated" })
}
