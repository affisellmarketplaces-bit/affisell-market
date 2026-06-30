import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { cancelSupplierFulfillmentJob } from "@/lib/admin/orders/cancel-supplier-job"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import {
  sendPaymentFailedEmail,
  type PaymentFailedOrderPayload,
} from "@/lib/emails/send-payment-failed"
import { prisma } from "@/lib/prisma"

const PAYMENT_FAILURE_CANCEL_ATTEMPTS = 3

function stripeCustomerIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const c = invoice.customer
  if (typeof c === "string" && c.trim()) return c.trim()
  if (c && typeof c === "object" && "id" in c && typeof c.id === "string") return c.id
  return null
}

export function resolveOrderIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const direct = invoice.metadata?.orderId?.trim()
  if (direct) return direct

  for (const line of invoice.lines?.data ?? []) {
    const fromLine = line.metadata?.orderId?.trim()
    if (fromLine) return fromLine
  }

  const extended = invoice as Stripe.Invoice & {
    subscription_details?: { metadata?: Record<string, string> }
  }
  const subMeta = extended.subscription_details?.metadata?.orderId?.trim()
  if (subMeta) return subMeta

  return null
}

async function persistStripeCustomerForBuyer(
  buyerUserId: string | null | undefined,
  stripeCustomerId: string
): Promise<void> {
  if (!buyerUserId) return
  await prisma.user.updateMany({
    where: { id: buyerUserId, stripeCustomerId: null },
    data: { stripeCustomerId },
  })
}

async function cancelOrderAfterRepeatedPaymentFailures(orderId: string): Promise<{
  cancelled: boolean
  emailSent: boolean
  error?: string
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      cancelledEmailSentAt: true,
      supplierFulfillmentLinks: {
        select: { supplierFulfillmentOrderId: true },
      },
    },
  })
  if (!order) return { cancelled: false, emailSent: false, error: "order_not_found" }
  if (order.status === "refunded" || order.cancelledEmailSentAt) {
    return { cancelled: false, emailSent: false, error: "already_cancelled" }
  }

  const jobIds = [
    ...new Set(order.supplierFulfillmentLinks.map((l) => l.supplierFulfillmentOrderId)),
  ]
  for (const jobId of jobIds) {
    const result = await cancelSupplierFulfillmentJob(jobId)
    if (!result.ok && result.error !== "not_cancellable" && result.error !== "missing_supplier_order_id") {
      console.error("[payment-failed] supplier_cancel", { orderId, jobId, error: result.error })
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: "FAILED",
      fulfillmentErrors: [
        { source: "stripe_invoice_payment_failed", attempts: PAYMENT_FAILURE_CANCEL_ATTEMPTS },
      ] as Prisma.InputJsonValue,
    },
  })

  const email = await notifyOrderCancelled(orderId, {
    cancelReason: "Paiement refusé après 3 tentatives — commande annulée",
    markRefunded: false,
  })

  console.log("[payment-failed] order_cancelled", {
    orderId,
    emailSent: email.sent,
    metric: "payment_failed_order_cancelled",
  })

  return { cancelled: true, emailSent: email.sent, error: email.error }
}

export async function handleStripeInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<{
  orderId: string | null
  attemptCount: number
  paymentFailedEmailSent: boolean
  orderCancelled: boolean
  skipped?: string
  error?: string
}> {
  const attemptCount = invoice.attempt_count ?? 1
  const orderId = resolveOrderIdFromInvoice(invoice)
  const stripeCustomerId = stripeCustomerIdFromInvoice(invoice)

  if (!orderId) {
    console.log("[payment-failed] skipped", {
      invoiceId: invoice.id,
      reason: "no_order_id_metadata",
      metric: "payment_failed_skipped",
    })
    return {
      orderId: null,
      attemptCount,
      paymentFailedEmailSent: false,
      orderCancelled: false,
      skipped: "no_order_id_metadata",
    }
  }

  if (!stripeCustomerId) {
    console.log("[payment-failed] skipped", {
      orderId,
      reason: "no_stripe_customer",
      metric: "payment_failed_skipped",
    })
    return {
      orderId,
      attemptCount,
      paymentFailedEmailSent: false,
      orderCancelled: false,
      skipped: "no_stripe_customer",
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: { select: { email: true, name: true, stripeCustomerId: true } },
      product: { select: { name: true, images: true } },
    },
  })

  if (!order) {
    return {
      orderId,
      attemptCount,
      paymentFailedEmailSent: false,
      orderCancelled: false,
      skipped: "order_not_found",
    }
  }

  await persistStripeCustomerForBuyer(order.buyerUserId, stripeCustomerId)

  if (attemptCount >= PAYMENT_FAILURE_CANCEL_ATTEMPTS) {
    const cancel = await cancelOrderAfterRepeatedPaymentFailures(orderId)
    return {
      orderId,
      attemptCount,
      paymentFailedEmailSent: false,
      orderCancelled: cancel.cancelled,
      error: cancel.error,
    }
  }

  if (order.paymentFailedEmailSentAt) {
    console.log("[payment-failed] skipped", {
      orderId,
      attemptCount,
      reason: "already_sent",
      metric: "payment_failed_skipped",
    })
    return {
      orderId,
      attemptCount,
      paymentFailedEmailSent: false,
      orderCancelled: false,
      skipped: "already_sent",
    }
  }

  if (order.status === "refunded") {
    return {
      orderId,
      attemptCount,
      paymentFailedEmailSent: false,
      orderCancelled: false,
      skipped: "order_refunded",
    }
  }

  const payload: PaymentFailedOrderPayload = {
    id: order.id,
    customerEmail: order.buyer?.email ?? order.customerEmail,
    variantImageUrl: order.variantImageUrl,
    shippingAddress: order.shippingAddress,
    buyer: order.buyer,
    product: order.product,
  }

  const customerForPortal = order.buyer?.stripeCustomerId ?? stripeCustomerId
  const send = await sendPaymentFailedEmail(payload, customerForPortal)
  if (!send.ok) {
    return {
      orderId,
      attemptCount,
      paymentFailedEmailSent: false,
      orderCancelled: false,
      error: send.error,
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { paymentFailedEmailSentAt: new Date() },
  })

  console.log("[payment-failed] handled", {
    orderId,
    attemptCount,
    paymentFailedEmailSent: true,
    metric: "payment_failed_email_sent",
  })

  return {
    orderId,
    attemptCount,
    paymentFailedEmailSent: true,
    orderCancelled: false,
  }
}
