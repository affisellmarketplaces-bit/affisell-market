import { render } from "@react-email/render"

import { SupplierBookingAlertEmail } from "@/emails/supplier-booking-alert"
import { copyForSupplierBookingAlert } from "@/lib/emails/supplier-booking-alert-copy"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"
import { prisma } from "@/lib/prisma"

function formatStartsAtLabel(iso: string, locale: AppLocale): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const loc = locale === "fr" ? "fr-FR" : "en-GB"
  return d.toLocaleString(loc, { dateStyle: "full", timeStyle: "short" })
}

export async function loadSupplierEmail(supplierId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: supplierId },
    select: { email: true, role: true },
  })
  if (!user || user.role !== "SUPPLIER") return null
  return user.email.trim() || null
}

export function supplierBookingRosterUrl(): string {
  return `${resolveAppUrl()}/dashboard/supplier/bookings`
}

export async function sendSupplierBookingAlertEmail(args: {
  orderId: string
  supplierId: string
  supplierEmail: string
  productName: string
  listingKind: string
  startsAt: string
  venueLabel: string | null
  seatLabels: string[]
  quantity: number
  customerEmail: string
  locale?: AppLocale | string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.log("[booking-supplier-alert]", {
      orderId: args.orderId,
      result: "email_skipped_no_resend",
    })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const copy = copyForSupplierBookingAlert(locale, args.listingKind)
  const buyerMasked = maskEmailForLog(args.customerEmail)

  const { to } = resolveResendDeliveryRecipient(
    "supplier-booking-alert",
    args.supplierEmail,
    config
  )

  try {
    const html = await render(
      SupplierBookingAlertEmail({
        productName: args.productName,
        startsAtLabel: formatStartsAtLabel(args.startsAt, locale),
        venueLabel: args.venueLabel,
        seatLabels: args.seatLabels,
        quantity: args.quantity,
        buyerMasked,
        rosterUrl: supplierBookingRosterUrl(),
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
    console.log("[booking-supplier-alert]", {
      orderId: args.orderId,
      supplierId: args.supplierId,
      result: "email_sent",
      buyer: buyerMasked,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[booking-supplier-alert]", {
      orderId: args.orderId,
      result: "email_failed",
      message,
    })
    return { ok: false, error: message }
  }
}

/** Idempotent instant supplier alert after pass confirmation. */
export async function notifySupplierBookingConfirmed(args: {
  orderId: string
  supplierId: string
  productName: string
  listingKind: string
  startsAt: string
  venueLabel: string | null
  seatLabels: string[]
  quantity: number
  customerEmail: string
  locale?: AppLocale | string | null
}): Promise<void> {
  const already = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: { bookingSupplierAlertSentAt: true },
  })
  if (already?.bookingSupplierAlertSentAt) return

  const supplierEmail = await loadSupplierEmail(args.supplierId)
  if (!supplierEmail) {
    console.log("[booking-supplier-alert]", {
      orderId: args.orderId,
      result: "skipped_no_supplier_email",
    })
    return
  }

  const sent = await sendSupplierBookingAlertEmail({
    ...args,
    supplierEmail,
  })
  if (!sent.ok) return

  await prisma.order.updateMany({
    where: { id: args.orderId, bookingSupplierAlertSentAt: null },
    data: { bookingSupplierAlertSentAt: new Date() },
  })
}
