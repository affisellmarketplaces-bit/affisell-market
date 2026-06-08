import {
  isExperienceListingKind,
  isMuseumListingKind,
  isRestaurantListingKind,
} from "@/lib/booking/types"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  normalizeE164Phone,
  readTwilioDeliveryConfig,
  sendTwilioSms,
} from "@/lib/sms/twilio-delivery"

export function bookingWaitlistSmsBody(args: {
  productName: string
  bookUrl: string
  startsAtIso: string
  listingKind: string
  locale: AppLocale
}): string {
  const restaurant = isRestaurantListingKind(args.listingKind)
  const museum = isMuseumListingKind(args.listingKind)
  const experience = isExperienceListingKind(args.listingKind)
  const d = new Date(args.startsAtIso)
  const timeLabel = Number.isFinite(d.getTime())
    ? d.toLocaleString(args.locale === "fr" ? "fr-FR" : "en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : args.startsAtIso

  if (args.locale === "fr") {
    if (restaurant) {
      return `Affisell · Table libre pour ${args.productName} (${timeLabel}). Réserver : ${args.bookUrl}`
    }
    if (museum) {
      return `Affisell · Entrée libre pour ${args.productName} (${timeLabel}). Réserver : ${args.bookUrl}`
    }
    return experience
      ? `Affisell · Places libres pour ${args.productName} (${timeLabel}). Réserver : ${args.bookUrl}`
      : `Affisell · Créneau libre pour ${args.productName} (${timeLabel}). Réserver : ${args.bookUrl}`
  }

  if (restaurant) {
    return `Affisell · Table open for ${args.productName} (${timeLabel}). Book: ${args.bookUrl}`
  }
  if (museum) {
    return `Affisell · Entry open for ${args.productName} (${timeLabel}). Book: ${args.bookUrl}`
  }
  return experience
    ? `Affisell · Seats open for ${args.productName} (${timeLabel}). Book: ${args.bookUrl}`
    : `Affisell · Slot open for ${args.productName} (${timeLabel}). Book: ${args.bookUrl}`
}

export async function sendBookingWaitlistSms(args: {
  waitlistId: string
  phone: string
  productName: string
  listingKind: string
  slotStartsAt: string
  affiliateProductId: string
  slotId: string
  locale?: AppLocale | string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readTwilioDeliveryConfig()
  if (!config) {
    console.log("[booking-waitlist-sms]", {
      waitlistId: args.waitlistId,
      result: "sms_skipped_no_twilio",
    })
    return { ok: false, error: "twilio_not_configured" }
  }

  const normalized = normalizeE164Phone(args.phone)
  if (!normalized) {
    console.log("[booking-waitlist-sms]", {
      waitlistId: args.waitlistId,
      result: "sms_skipped_invalid_phone",
    })
    return { ok: false, error: "invalid_phone" }
  }

  const locale = resolveEmailLocale(args.locale)
  const base = resolveAppUrl()
  const bookUrl = `${base}/marketplace/${args.affiliateProductId}?bookingSlotId=${encodeURIComponent(args.slotId)}`
  const body = bookingWaitlistSmsBody({
    productName: args.productName,
    bookUrl,
    startsAtIso: args.slotStartsAt,
    listingKind: args.listingKind,
    locale,
  })

  const result = await sendTwilioSms({
    config,
    to: normalized,
    body,
    context: "booking-waitlist-sms",
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  console.log("[booking-waitlist-sms]", {
    waitlistId: args.waitlistId,
    result: "sms_sent",
    slotId: args.slotId,
  })
  return { ok: true }
}
