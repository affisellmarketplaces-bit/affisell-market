import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

export type OrderConfirmationEmailCopy = {
  preview: string
  heading: string
  quantity: string
  total: string
  ctaOrder: string
  ctaTracking: string
  footer: string
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

export function loadOrderConfirmationEmailCopy(
  locale: AppLocale,
  vars: { orderId: string; quantity: number; total: string; currency: string }
): OrderConfirmationEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()

  return {
    preview: interpolate(tMessage(locale, "emails.orderConfirmation.preview"), {
      orderId: shortOrderId,
    }),
    heading: tMessage(locale, "emails.orderConfirmation.heading"),
    quantity: interpolate(tMessage(locale, "emails.orderConfirmation.quantity"), {
      quantity: vars.quantity,
    }),
    total: interpolate(tMessage(locale, "emails.orderConfirmation.total"), {
      total: vars.total,
      currency: vars.currency,
    }),
    ctaOrder: tMessage(locale, "emails.orderConfirmation.ctaOrder"),
    ctaTracking: tMessage(locale, "emails.orderConfirmation.ctaTracking"),
    footer: tMessage(locale, "emails.orderConfirmation.footer"),
  }
}

export function orderConfirmationEmailSubject(locale: AppLocale, orderId: string): string {
  const shortOrderId = orderId.slice(-6).toUpperCase()
  return interpolate(tMessage(locale, "emails.orderConfirmation.preview"), { orderId: shortOrderId })
}
