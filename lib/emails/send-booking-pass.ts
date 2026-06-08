import { render } from "@react-email/render"
import { Resend } from "resend"

import { BookingAccessPassEmail } from "@/emails/booking-access-pass"
import { copyForBookingPassEmail } from "@/lib/emails/booking-pass-copy"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"

function formatStartsAtLabel(iso: string, locale: AppLocale): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const loc =
    locale === "fr"
      ? "fr-FR"
      : locale === "de"
        ? "de-DE"
        : locale === "es"
          ? "es-ES"
          : locale === "it"
            ? "it-IT"
            : locale === "nl"
              ? "nl-NL"
              : locale === "pl"
                ? "pl-PL"
                : locale === "zh"
                  ? "zh-CN"
                  : "en-GB"
  return d.toLocaleString(loc, { dateStyle: "full", timeStyle: "short" })
}

export async function sendBookingPassEmail(args: {
  orderId: string
  productName: string
  customerEmail: string
  passPath: string
  startsAt: string
  venueLabel: string | null
  listingKind?: string | null
  locale?: AppLocale | string | null
}): Promise<{ ok: boolean; error?: string }> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.error("[booking]", { orderId: args.orderId, result: "email_skipped_no_resend" })
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const locale = resolveEmailLocale(args.locale)
  const copyPack = copyForBookingPassEmail(locale, args.listingKind ?? "SERVICE")
  const base = resolveAppUrl()
  const passUrl = `${base}${args.passPath.startsWith("/") ? args.passPath : `/${args.passPath}`}`

  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("booking-access-pass", args.customerEmail, config)

  try {
    const html = await render(
      BookingAccessPassEmail({
        productName: args.productName,
        passUrl,
        startsAtLabel: formatStartsAtLabel(args.startsAt, locale),
        venueLabel: args.venueLabel,
        copy: copyPack,
      })
    )
    await resend.emails.send({
      from: config.from,
      to,
      subject: copyPack.subject(args.productName),
      html,
    })
    console.log("[booking]", {
      orderId: args.orderId,
      result: "email_sent",
      listingKind: args.listingKind ?? "SERVICE",
      locale,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[booking]", { orderId: args.orderId, result: "email_failed", message })
    return { ok: false, error: message }
  }
}
