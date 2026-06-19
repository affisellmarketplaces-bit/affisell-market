import { render } from "@react-email/render"

import { AffiliateNewSaleAlertEmail } from "@/emails/affiliate-new-sale-alert"
import { MerchantNewOrderAlertEmail } from "@/emails/merchant-new-order-alert"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import {
  copyForAffiliateNewSaleAlert,
  copyForMerchantNewOrderAlert,
  formatMerchantAlertMoney,
  shortMerchantOrderRef,
} from "@/lib/emails/merchant-order-alert-copy"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { readResendDeliveryConfig, resolveResendDeliveryRecipient } from "@/lib/emails/resend-delivery"
import { prisma } from "@/lib/prisma"

function supplierOrdersUrl(): string {
  return `${resolveAppUrl()}/dashboard/supplier/orders`
}

function affiliateEarningsUrl(): string {
  return `${resolveAppUrl()}/dashboard/affiliate/earnings`
}

function affiliateNetEarningsCents(order: {
  commissionCents: number
  affiliateMarginRetainedCents: number | null
  affiliateFeeCents: number
}): number {
  const gross =
    Math.max(0, order.commissionCents) +
    Math.max(0, order.affiliateMarginRetainedCents ?? 0)
  return Math.max(0, gross - Math.max(0, order.affiliateFeeCents))
}

/** Idempotent Resend alerts for supplier + affiliate after marketplace checkout paid. */
export async function dispatchMerchantOrderAlerts(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      quantity: true,
      customerEmail: true,
      variantLabel: true,
      variantImageUrl: true,
      currency: true,
      supplierPayoutCents: true,
      commissionCents: true,
      affiliateMarginRetainedCents: true,
      affiliateFeeCents: true,
      buyerLocale: true,
      merchantSupplierEmailSentAt: true,
      merchantAffiliateEmailSentAt: true,
      product: { select: { name: true } },
      affiliate: {
        select: {
          email: true,
          store: { select: { partnerListingCode: true } },
        },
      },
      supplier: { select: { email: true } },
    },
  })

  if (!order || order.status !== "paid") return

  const config = readResendDeliveryConfig()
  if (!config) {
    console.log("[merchant-order-alerts]", { orderId, result: "email_skipped_no_resend" })
    return
  }

  const orderRef = shortMerchantOrderRef(order.id)
  const productName = order.product.name
  const variantLabel = order.variantLabel
  const quantity = Math.max(1, order.quantity)
  const buyerMasked = maskEmailForLog(order.customerEmail)
  const partnerListingCode = order.affiliate.store?.partnerListingCode?.trim() || null
  const payoutLabel = formatMerchantAlertMoney(order.supplierPayoutCents)
  const earningsLabel = formatMerchantAlertMoney(affiliateNetEarningsCents(order))

  const emailLocale = resolveEmailLocale(order.buyerLocale)

  if (!order.merchantSupplierEmailSentAt) {
    const supplierEmail = order.supplier.email.trim()
    if (!supplierEmail) {
      console.log("[merchant-order-alerts]", {
        orderId,
        result: "supplier_email_skipped_no_address",
      })
    } else {
      const locale = emailLocale
      const copy = copyForMerchantNewOrderAlert(locale)
      const { to } = resolveResendDeliveryRecipient(
        "merchant-new-order-alert",
        supplierEmail,
        config
      )

      try {
        const html = await render(
          MerchantNewOrderAlertEmail({
            productName,
            variantLabel,
            quantity,
            buyerMasked,
            partnerListingCode,
            payoutLabel,
            orderRef,
            ordersUrl: supplierOrdersUrl(),
            copy,
          })
        )
        const { Resend } = await import("resend")
        const resend = new Resend(config.apiKey)
        const { data } = await resend.emails.send({
          from: config.from,
          to,
          subject: copy.subject(productName),
          html,
        })

        const claimed = await prisma.order.updateMany({
          where: { id: orderId, merchantSupplierEmailSentAt: null },
          data: { merchantSupplierEmailSentAt: new Date() },
        })

        if (claimed.count > 0) {
          console.log("[merchant-order-alerts]", {
            orderId,
            role: "SUPPLIER",
            result: "email_sent",
            resendId: data?.id,
          })
        }
      } catch (error) {
        console.error("[merchant-order-alerts]", {
          orderId,
          role: "SUPPLIER",
          result: "email_failed",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (!order.merchantAffiliateEmailSentAt) {
    const affiliateEmail = order.affiliate.email.trim()
    if (!affiliateEmail) {
      console.log("[merchant-order-alerts]", {
        orderId,
        result: "affiliate_email_skipped_no_address",
      })
    } else {
      const locale = emailLocale
      const copy = copyForAffiliateNewSaleAlert(locale)
      const { to } = resolveResendDeliveryRecipient(
        "affiliate-new-sale-alert",
        affiliateEmail,
        config
      )

      try {
        const html = await render(
          AffiliateNewSaleAlertEmail({
            productName,
            variantLabel,
            quantity,
            earningsLabel,
            orderRef,
            earningsUrl: affiliateEarningsUrl(),
            copy,
          })
        )
        const { Resend } = await import("resend")
        const resend = new Resend(config.apiKey)
        const { data } = await resend.emails.send({
          from: config.from,
          to,
          subject: copy.subject(productName),
          html,
        })

        const claimed = await prisma.order.updateMany({
          where: { id: orderId, merchantAffiliateEmailSentAt: null },
          data: { merchantAffiliateEmailSentAt: new Date() },
        })

        if (claimed.count > 0) {
          console.log("[merchant-order-alerts]", {
            orderId,
            role: "AFFILIATE",
            result: "email_sent",
            resendId: data?.id,
          })
        }
      } catch (error) {
        console.error("[merchant-order-alerts]", {
          orderId,
          role: "AFFILIATE",
          result: "email_failed",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
}
