import type Stripe from "stripe"

import { AbandonedCheckoutEmail } from "@/emails/abandoned-checkout"
import { logBusiness } from "@/lib/business-log"
import {
  abandonedCheckoutEmailSubject,
  defaultEmailCustomerName,
  loadAbandonedCheckoutEmailCopy,
} from "@/lib/emails/load-email-copy"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { resolveAppUrl, resolveOrderConfirmationImageUrl } from "@/lib/emails/send-order-confirmation"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

function resolveCustomerName(email: string, session: Stripe.Checkout.Session, locale: string): string {
  const fromDetails = session.customer_details?.name?.trim()
  if (fromDetails) return fromDetails
  const local = email.split("@")[0]?.trim()
  return local || defaultEmailCustomerName(resolveEmailLocale(locale))
}

function resolveProductUrl(affiliateProductId: string): string {
  return `${resolveAppUrl()}/marketplace/${affiliateProductId}`
}

/**
 * On checkout.session.expired: cancel pending order + one recovery email (idempotent via ProcessedWebhook).
 */
export async function handleStripeCheckoutSessionExpired(
  session: Stripe.Checkout.Session
): Promise<{ sent: boolean; orderId?: string; skipped?: string }> {
  const email =
    session.customer_email?.trim() ||
    session.customer_details?.email?.trim() ||
    ""
  const meta = session.metadata ?? {}
  const orderId = meta.orderId?.trim()
  const affiliateProductId = meta.affiliateProductId?.trim()
  const locale = resolveEmailLocale(meta.locale)

  if (orderId) {
    await prisma.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CANCELLED" },
    })
    const { releaseBookingSlotHoldForOrder } = await import("@/lib/booking/slot-hold")
    await releaseBookingSlotHoldForOrder(orderId).catch((e: unknown) => {
      console.error("[booking]", {
        orderId,
        result: "hold_release_on_session_expired_failed",
        error: e instanceof Error ? e.message : String(e),
      })
    })
  }

  if (!email) {
    logBusiness("abandoned-checkout", { sessionId: session.id, result: "skipped", reason: "no_email" })
    return { sent: false, orderId: orderId ?? undefined, skipped: "no_email" }
  }

  if (!affiliateProductId) {
    logBusiness("abandoned-checkout", { sessionId: session.id, result: "skipped", reason: "no_listing" })
    return { sent: false, orderId: orderId ?? undefined, skipped: "no_listing" }
  }

  const listing = await prisma.affiliateProduct.findUnique({
    where: { id: affiliateProductId },
    select: {
      id: true,
      sellingPriceCents: true,
      product: { select: { name: true, images: true } },
    },
  })

  if (!listing) {
    logBusiness("abandoned-checkout", {
      sessionId: session.id,
      affiliateProductId,
      result: "skipped",
      reason: "listing_not_found",
    })
    return { sent: false, orderId: orderId ?? undefined, skipped: "listing_not_found" }
  }

  const productImageUrl = resolveOrderConfirmationImageUrl({
    productImages: listing.product.images,
    variantImageUrl: null,
  })

  const baseUrl = resolveAppUrl()
  const customerName = resolveCustomerName(email, session, meta.locale)
  const copy = loadAbandonedCheckoutEmailCopy(locale, {
    customerName,
    productName: listing.product.name,
  })

  const sent = await sendResendReactEmail({
    context: "abandoned-checkout",
    intendedTo: email,
    subject: abandonedCheckoutEmailSubject(locale, listing.product.name),
    template: AbandonedCheckoutEmail,
    props: {
      productName: listing.product.name,
      productImageUrl: productImageUrl || undefined,
      productUrl: resolveProductUrl(listing.id),
      priceLabel: formatStoreCurrencyFromCents(listing.sellingPriceCents),
      faqUrl: `${baseUrl}/faq`,
      supportUrl: `${baseUrl}/support`,
      copy,
    },
  })

  logBusiness("abandoned-checkout", {
    sessionId: session.id,
    orderId: orderId ?? null,
    affiliateProductId,
    locale,
    result: sent.ok ? "email_sent" : "email_failed",
    error: sent.ok ? undefined : sent.error,
  })

  return { sent: sent.ok, orderId: orderId ?? undefined, skipped: sent.ok ? undefined : sent.error }
}
