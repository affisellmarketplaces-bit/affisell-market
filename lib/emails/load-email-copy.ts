import type { PasswordResetPortal } from "@/emails/password-reset"
import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"
import { emailSubject, formatEmailDate, interpolate } from "@/lib/emails/email-copy-utils"

export type OrderConfirmationEmailCopy = {
  preview: string
  heading: string
  quantity: string
  total: string
  ctaOrder: string
  ctaTracking: string
  footer: string
}

export type ShippingNotificationEmailCopy = {
  preview: string
  heading: string
  quantity: string
  trackingNumber: string
  carrier: string
  ctaTrack: string
  ctaOrder: string
  footer: string
}

export type DeliveredNotificationEmailCopy = {
  preview: string
  heading: string
  greeting: string
  quantity: string
  reviewTitle: string
  reviewBody: string
  ctaReview: string
  ctaRepurchase: string
  ctaOrder: string
  footer: string
}

export type CancelledNotificationEmailCopy = {
  preview: string
  heading: string
  greeting: string
  quantity: string
  refundAmount: string
  refundHint: string
  reasonPrefix: string
  ctaSupport: string
  ctaOrder: string
  footer: string
}

export type ReviewReminderEmailCopy = {
  preview: string
  heading: string
  greeting: string
  body: string
  ctaTitle: string
  ctaReview: string
  footerNote: string
  footer: string
}

export type RepurchaseReminderEmailCopy = {
  preview: string
  heading: string
  greeting: string
  body: string
  ctaTitle: string
  ctaRepurchase: string
  footerNote: string
  footer: string
}

export type PaymentFailedEmailCopy = {
  preview: string
  heading: string
  greeting: string
  body: string
  ctaUpdate: string
  footerNote: string
  footer: string
}

export type PasswordResetEmailCopy = {
  preview: string
  badge: string
  title: string
  greeting: string
  body: string
  accountLabel: string
  spaceLabel: string
  cta: string
  fallbackLabel: string
  footerNote: string
  legal: string
}

export type ContactAcknowledgmentEmailCopy = {
  preview: string
  heading: string
  greeting: string
  body: string
  reference: string
  cardTitle: string
  faqLink: string
  ordersLink: string
  ctaFaq: string
  footer: string
}

export type AbandonedCheckoutEmailCopy = {
  preview: string
  heading: string
  greeting: string
  body: string
  rolloutNote?: string
  cta: string
  footer: string
}

function t(locale: AppLocale, path: string): string {
  return tMessage(locale, path)
}

export function loadOrderConfirmationEmailCopy(
  locale: AppLocale,
  vars: { orderId: string; quantity: number; total: string; currency: string }
): OrderConfirmationEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()

  return {
    preview: interpolate(t(locale, "emails.orderConfirmation.preview"), { orderId: shortOrderId }),
    heading: t(locale, "emails.orderConfirmation.heading"),
    quantity: interpolate(t(locale, "emails.orderConfirmation.quantity"), { quantity: vars.quantity }),
    total: interpolate(t(locale, "emails.orderConfirmation.total"), {
      total: vars.total,
      currency: vars.currency,
    }),
    ctaOrder: t(locale, "emails.orderConfirmation.ctaOrder"),
    ctaTracking: t(locale, "emails.orderConfirmation.ctaTracking"),
    footer: t(locale, "emails.orderConfirmation.footer"),
  }
}

export function orderConfirmationEmailSubject(locale: AppLocale, orderId: string): string {
  return emailSubject(locale, "emails.orderConfirmation.preview", {
    orderId: orderId.slice(-6).toUpperCase(),
  })
}

export function loadShippingNotificationEmailCopy(
  locale: AppLocale,
  vars: {
    orderId: string
    quantity: number
    trackingNumber: string
    carrier: string
  }
): ShippingNotificationEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()

  return {
    preview: interpolate(t(locale, "emails.shippingNotification.preview"), { orderId: shortOrderId }),
    heading: t(locale, "emails.shippingNotification.heading"),
    quantity: interpolate(t(locale, "emails.shared.quantity"), { quantity: vars.quantity }),
    trackingNumber: interpolate(t(locale, "emails.shippingNotification.trackingNumber"), {
      trackingNumber: vars.trackingNumber,
    }),
    carrier: interpolate(t(locale, "emails.shippingNotification.carrier"), {
      carrier: vars.carrier || t(locale, "emails.shippingNotification.defaultCarrier"),
    }),
    ctaTrack: t(locale, "emails.shippingNotification.ctaTrack"),
    ctaOrder: t(locale, "emails.shared.ctaOrder"),
    footer: t(locale, "emails.shared.footerBrand"),
  }
}

export function shippingNotificationEmailSubject(locale: AppLocale, orderId: string): string {
  return emailSubject(locale, "emails.shippingNotification.subject", {
    orderId: orderId.slice(-6).toUpperCase(),
  })
}

export function loadDeliveredNotificationEmailCopy(
  locale: AppLocale,
  vars: { orderId: string; quantity: number; customerName: string }
): DeliveredNotificationEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()

  return {
    preview: interpolate(t(locale, "emails.deliveredNotification.preview"), { orderId: shortOrderId }),
    heading: t(locale, "emails.deliveredNotification.heading"),
    greeting: interpolate(t(locale, "emails.deliveredNotification.greeting"), {
      customerName: vars.customerName,
    }),
    quantity: interpolate(t(locale, "emails.shared.quantity"), { quantity: vars.quantity }),
    reviewTitle: t(locale, "emails.deliveredNotification.reviewTitle"),
    reviewBody: t(locale, "emails.deliveredNotification.reviewBody"),
    ctaReview: t(locale, "emails.deliveredNotification.ctaReview"),
    ctaRepurchase: t(locale, "emails.deliveredNotification.ctaRepurchase"),
    ctaOrder: t(locale, "emails.shared.ctaOrder"),
    footer: t(locale, "emails.shared.footerBrand"),
  }
}

export function deliveredNotificationEmailSubject(locale: AppLocale, orderId: string): string {
  return emailSubject(locale, "emails.deliveredNotification.subject", {
    orderId: orderId.slice(-6).toUpperCase(),
  })
}

export function loadCancelledNotificationEmailCopy(
  locale: AppLocale,
  vars: {
    orderId: string
    quantity: number
    customerName: string
    refundAmount: string
    currency: string
    cancelReason?: string
  }
): CancelledNotificationEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()

  return {
    preview: interpolate(t(locale, "emails.cancelledNotification.preview"), { orderId: shortOrderId }),
    heading: t(locale, "emails.cancelledNotification.heading"),
    greeting: interpolate(t(locale, "emails.cancelledNotification.greeting"), {
      customerName: vars.customerName,
      orderId: shortOrderId,
    }),
    quantity: interpolate(t(locale, "emails.shared.quantity"), { quantity: vars.quantity }),
    refundAmount: interpolate(t(locale, "emails.cancelledNotification.refundAmount"), {
      amount: vars.refundAmount,
      currency: vars.currency,
    }),
    refundHint: t(locale, "emails.cancelledNotification.refundHint"),
    reasonPrefix: vars.cancelReason
      ? interpolate(t(locale, "emails.cancelledNotification.reasonPrefix"), {
          reason: vars.cancelReason,
        })
      : "",
    ctaSupport: t(locale, "emails.cancelledNotification.ctaSupport"),
    ctaOrder: t(locale, "emails.shared.ctaOrder"),
    footer: t(locale, "emails.shared.footerBrand"),
  }
}

export function cancelledNotificationEmailSubject(locale: AppLocale, orderId: string): string {
  return emailSubject(locale, "emails.cancelledNotification.subject", {
    orderId: orderId.slice(-6).toUpperCase(),
  })
}

export function loadReviewReminderEmailCopy(
  locale: AppLocale,
  vars: { orderId: string; customerName: string; deliveredAt: Date }
): ReviewReminderEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()
  const deliveredLabel = formatEmailDate(vars.deliveredAt, locale)

  return {
    preview: interpolate(t(locale, "emails.reviewReminder.preview"), { orderId: shortOrderId }),
    heading: t(locale, "emails.reviewReminder.heading"),
    greeting: interpolate(t(locale, "emails.shared.greeting"), { customerName: vars.customerName }),
    body: interpolate(t(locale, "emails.reviewReminder.body"), { deliveredAt: deliveredLabel }),
    ctaTitle: t(locale, "emails.reviewReminder.ctaTitle"),
    ctaReview: t(locale, "emails.reviewReminder.ctaReview"),
    footerNote: t(locale, "emails.reviewReminder.footerNote"),
    footer: t(locale, "emails.shared.footerBrand"),
  }
}

export function reviewReminderEmailSubject(locale: AppLocale, orderId: string): string {
  return emailSubject(locale, "emails.reviewReminder.subject", {
    orderId: orderId.slice(-6).toUpperCase(),
  })
}

export function loadRepurchaseReminderEmailCopy(
  locale: AppLocale,
  vars: { orderId: string; customerName: string; productName: string }
): RepurchaseReminderEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()

  return {
    preview: interpolate(t(locale, "emails.repurchaseReminder.preview"), {
      productName: vars.productName,
    }),
    heading: t(locale, "emails.repurchaseReminder.heading"),
    greeting: interpolate(t(locale, "emails.shared.greeting"), { customerName: vars.customerName }),
    body: interpolate(t(locale, "emails.repurchaseReminder.body"), {
      productName: vars.productName,
      orderId: shortOrderId,
    }),
    ctaTitle: t(locale, "emails.repurchaseReminder.ctaTitle"),
    ctaRepurchase: t(locale, "emails.repurchaseReminder.ctaRepurchase"),
    footerNote: t(locale, "emails.repurchaseReminder.footerNote"),
    footer: t(locale, "emails.shared.footerBrand"),
  }
}

export function repurchaseReminderEmailSubject(
  locale: AppLocale,
  productName: string
): string {
  return emailSubject(locale, "emails.repurchaseReminder.subject", { productName })
}

export function loadPaymentFailedEmailCopy(
  locale: AppLocale,
  vars: { orderId: string; customerName: string }
): PaymentFailedEmailCopy {
  const shortOrderId = vars.orderId.slice(-6).toUpperCase()

  return {
    preview: interpolate(t(locale, "emails.paymentFailed.preview"), { orderId: shortOrderId }),
    heading: t(locale, "emails.paymentFailed.heading"),
    greeting: interpolate(t(locale, "emails.shared.greeting"), { customerName: vars.customerName }),
    body: t(locale, "emails.paymentFailed.body"),
    ctaUpdate: t(locale, "emails.paymentFailed.ctaUpdate"),
    footerNote: t(locale, "emails.paymentFailed.footerNote"),
    footer: t(locale, "emails.shared.footerBrand"),
  }
}

export function paymentFailedEmailSubject(locale: AppLocale, orderId: string): string {
  return emailSubject(locale, "emails.paymentFailed.subject", {
    orderId: orderId.slice(-6).toUpperCase(),
  })
}

export function loadPasswordResetEmailCopy(
  locale: AppLocale,
  vars: { name?: string | null; accountEmail: string; portal?: PasswordResetPortal }
): PasswordResetEmailCopy {
  const greetingName = vars.name?.trim()
  const greeting = greetingName
    ? interpolate(t(locale, "emails.passwordReset.greetingNamed"), { name: greetingName })
    : t(locale, "emails.passwordReset.greetingGeneric")

  const spaceLabel =
    vars.portal === "affiliate"
      ? t(locale, "emails.passwordReset.portalAffiliate")
      : vars.portal === "supplier"
        ? t(locale, "emails.passwordReset.portalSupplier")
        : vars.portal === "agent"
          ? t(locale, "emails.passwordReset.portalAgent")
          : t(locale, "emails.passwordReset.portalDefault")

  return {
    preview: interpolate(t(locale, "emails.passwordReset.preview"), {
      accountEmail: vars.accountEmail,
    }),
    badge: t(locale, "emails.passwordReset.badge"),
    title: t(locale, "emails.passwordReset.title"),
    greeting,
    body: t(locale, "emails.passwordReset.body"),
    accountLabel: t(locale, "emails.passwordReset.accountLabel"),
    spaceLabel,
    cta: t(locale, "emails.passwordReset.cta"),
    fallbackLabel: t(locale, "emails.passwordReset.fallbackLabel"),
    footerNote: t(locale, "emails.passwordReset.footerNote"),
    legal: t(locale, "emails.passwordReset.legal"),
  }
}

export function passwordResetEmailSubject(locale: AppLocale, accountEmail: string): string {
  return interpolate(t(locale, "emails.passwordReset.subject"), { accountEmail })
}

export function loadContactAcknowledgmentEmailCopy(
  locale: AppLocale,
  vars: { customerName: string; subject: string; ticketRef: string; supportEmail: string }
): ContactAcknowledgmentEmailCopy {
  return {
    preview: interpolate(t(locale, "emails.contactAcknowledgment.preview"), {
      ticketRef: vars.ticketRef,
    }),
    heading: t(locale, "emails.contactAcknowledgment.heading"),
    greeting: interpolate(t(locale, "emails.shared.greeting"), { customerName: vars.customerName }),
    body: interpolate(t(locale, "emails.contactAcknowledgment.body"), { subject: vars.subject }),
    reference: interpolate(t(locale, "emails.contactAcknowledgment.reference"), {
      ticketRef: vars.ticketRef,
    }),
    cardTitle: t(locale, "emails.contactAcknowledgment.cardTitle"),
    faqLink: t(locale, "emails.contactAcknowledgment.faqLink"),
    ordersLink: t(locale, "emails.contactAcknowledgment.ordersLink"),
    ctaFaq: t(locale, "emails.contactAcknowledgment.ctaFaq"),
    footer: interpolate(t(locale, "emails.contactAcknowledgment.footer"), {
      supportEmail: vars.supportEmail,
      ticketRef: vars.ticketRef,
    }),
  }
}

export function contactAcknowledgmentEmailSubject(locale: AppLocale, ticketRef: string): string {
  return interpolate(t(locale, "emails.contactAcknowledgment.subject"), { ticketRef })
}

export function loadAbandonedCheckoutEmailCopy(
  locale: AppLocale,
  vars: { customerName: string; productName: string }
): AbandonedCheckoutEmailCopy {
  return {
    preview: interpolate(t(locale, "emails.abandonedCheckout.preview"), {
      productName: vars.productName,
    }),
    heading: t(locale, "emails.abandonedCheckout.heading"),
    greeting: interpolate(t(locale, "emails.shared.greeting"), { customerName: vars.customerName }),
    body: t(locale, "emails.abandonedCheckout.body"),
    cta: t(locale, "emails.abandonedCheckout.cta"),
    footer: t(locale, "emails.abandonedCheckout.footer"),
  }
}

export function abandonedCheckoutEmailSubject(locale: AppLocale, productName: string): string {
  return interpolate(t(locale, "emails.abandonedCheckout.subject"), { productName })
}

export function defaultEmailCustomerName(locale: AppLocale): string {
  return t(locale, "emails.shared.defaultCustomerName")
}
