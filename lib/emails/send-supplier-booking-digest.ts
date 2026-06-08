import { render } from "@react-email/render"

import { SupplierBookingDigestEmail } from "@/emails/supplier-booking-digest"
import { resolveDigestListingKind } from "@/lib/booking/vertical-copy"
import { copyForSupplierBookingDigest } from "@/lib/emails/supplier-booking-alert-copy"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"
import { supplierBookingRosterUrl } from "@/lib/emails/send-supplier-booking-alert"

export type SupplierDigestOrderRow = {
  orderId: string
  productName: string
  startsAt: string
  seatLabels: string[]
  quantity: number
  customerEmail: string
  listingKind?: string | null
}

function formatDateLabel(date: Date, locale: AppLocale): string {
  const loc = locale === "fr" ? "fr-FR" : "en-GB"
  return date.toLocaleDateString(loc, { weekday: "long", dateStyle: "full" })
}

function formatTimeLabel(iso: string, locale: AppLocale): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const loc = locale === "fr" ? "fr-FR" : "en-GB"
  return d.toLocaleString(loc, { dateStyle: "short", timeStyle: "short" })
}

export async function sendSupplierBookingDigestEmail(args: {
  supplierId: string
  supplierEmail: string
  day: Date
  rows: SupplierDigestOrderRow[]
  locale?: AppLocale | string | null
}): Promise<{ ok: boolean; error?: string }> {
  if (args.rows.length === 0) return { ok: false, error: "empty" }

  const config = readResendDeliveryConfig()
  if (!config) {
    console.log("[booking-supplier-digest]", {
      supplierId: args.supplierId,
      result: "email_skipped_no_resend",
    })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const digestListingKind = resolveDigestListingKind(args.rows)
  const copy = copyForSupplierBookingDigest(locale, digestListingKind)
  const dateLabel = formatDateLabel(args.day, locale)

  const { to } = resolveResendDeliveryRecipient(
    "supplier-booking-digest",
    args.supplierEmail,
    config
  )

  try {
    const html = await render(
      SupplierBookingDigestEmail({
        dateLabel,
        rosterUrl: supplierBookingRosterUrl(),
        copy,
        rows: args.rows.map((row) => ({
          productName: row.productName,
          startsAtLabel: formatTimeLabel(row.startsAt, locale),
          seatLabels: row.seatLabels,
          quantity: row.quantity,
          buyerMasked: maskEmailForLog(row.customerEmail),
        })),
      })
    )
    const { Resend } = await import("resend")
    const resend = new Resend(config.apiKey)
    await resend.emails.send({
      from: config.from,
      to,
      subject: copy.subject(args.rows.length, dateLabel),
      html,
    })
    console.log("[booking-supplier-digest]", {
      supplierId: args.supplierId,
      result: "email_sent",
      count: args.rows.length,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[booking-supplier-digest]", {
      supplierId: args.supplierId,
      result: "email_failed",
      message,
    })
    return { ok: false, error: message }
  }
}
