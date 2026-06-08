import { bookingPassPath } from "@/lib/booking/pass-token"
import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import { bookingVerticalCopyFamily } from "@/lib/booking/vertical-copy"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  normalizeE164Phone,
  readTwilioDeliveryConfig,
  sendTwilioSms,
} from "@/lib/sms/twilio-delivery"

export function bookingReminderSmsBody(args: {
  productName: string
  passUrl: string
  startsAtIso: string
  listingKind: string
  locale: AppLocale
}): string {
  const family = bookingVerticalCopyFamily(args.listingKind)
  const d = new Date(args.startsAtIso)
  const timeLabel = Number.isFinite(d.getTime())
    ? d.toLocaleString(args.locale === "fr" ? "fr-FR" : "en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : args.startsAtIso

  if (args.locale === "fr") {
    if (family === "restaurant") {
      return `Affisell · Table ${args.productName} dans ~2 h (${timeLabel}). Passe : ${args.passUrl}`
    }
    if (family === "museum") {
      return `Affisell · Visite ${args.productName} dans ~2 h (${timeLabel}). Passe : ${args.passUrl}`
    }
    if (family === "experience") {
      return `Affisell · ${args.productName} dans ~2 h (${timeLabel}). Passe : ${args.passUrl}`
    }
    return `Affisell · RDV ${args.productName} dans ~2 h (${timeLabel}). Passe : ${args.passUrl}`
  }

  if (family === "restaurant") {
    return `Affisell · Table at ${args.productName} in ~2 h (${timeLabel}). Pass: ${args.passUrl}`
  }
  if (family === "museum") {
    return `Affisell · Visit ${args.productName} in ~2 h (${timeLabel}). Pass: ${args.passUrl}`
  }
  if (family === "experience") {
    return `Affisell · ${args.productName} in ~2 h (${timeLabel}). Pass: ${args.passUrl}`
  }
  return `Affisell · ${args.productName} appointment in ~2 h (${timeLabel}). Pass: ${args.passUrl}`
}

export async function sendBookingReminderSms(args: {
  orderId: string
  customerPhone: string
  productName: string
  bookingToken: string
  bookingSnapshot: unknown
  listingKind: string | null
  locale?: AppLocale | string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readTwilioDeliveryConfig()
  if (!config) {
    console.log("[booking-reminder-sms]", {
      orderId: args.orderId,
      result: "sms_skipped_no_twilio",
    })
    return { ok: false, error: "twilio_not_configured" }
  }

  const phone = normalizeE164Phone(args.customerPhone)
  if (!phone) {
    console.log("[booking-reminder-sms]", {
      orderId: args.orderId,
      result: "sms_skipped_invalid_phone",
    })
    return { ok: false, error: "invalid_phone" }
  }

  const locale = resolveEmailLocale(args.locale)
  const snapshot = parseBookingSnapshot(args.bookingSnapshot)
  const listingKind = args.listingKind ?? snapshot?.listingKind ?? "SERVICE"
  const base = resolveAppUrl()
  const passUrl = `${base}${bookingPassPath(args.bookingToken)}`
  const body = bookingReminderSmsBody({
    productName: snapshot?.productName || args.productName,
    passUrl,
    startsAtIso: snapshot?.startsAt ?? new Date().toISOString(),
    listingKind,
    locale,
  })

  const result = await sendTwilioSms({
    config,
    to: phone,
    body,
    context: "booking-reminder-sms",
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  console.log("[booking-reminder-sms]", {
    orderId: args.orderId,
    result: "sms_sent",
  })
  return { ok: true }
}
