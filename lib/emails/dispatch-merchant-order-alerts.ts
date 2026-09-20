import { reconcileMarketplaceOrderPartnerAmounts } from "@/lib/marketplace-order-settlement-reconcile"
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
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { resolveSupportEmail } from "@/lib/legal/company-env"
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

function merchantAlertTags(role: "supplier" | "affiliate", orderId: string) {
  return [
    { name: "merchant-alert", value: role },
    { name: "order-id", value: orderId.slice(0, 48) },
  ]
}

export type DispatchMerchantOrderAlertsOptions = {
  /** Clear supplier sent flag then send again (ops heal when inbox never arrived). */
  forceSupplier?: boolean
  /** Clear affiliate sent flag then send again. */
  forceAffiliate?: boolean
}

/** Idempotent Resend alerts for supplier + affiliate after marketplace checkout paid. */
export async function dispatchMerchantOrderAlerts(
  orderId: string,
  options: DispatchMerchantOrderAlertsOptions = {}
): Promise<void> {
  // Partner amounts of a fresh order are completed by the reconcile step: run it BEFORE reading them, otherwise the
  // reseller alert can go out with "Your earnings €0.00". Idempotent (no-op once the amounts are complete).
  try {
    await reconcileMarketplaceOrderPartnerAmounts(orderId)
  } catch (error) {
    console.error("[merchant-order-alerts]", {
      orderId,
      result: "reconcile_before_alert_failed",
      error: error instanceof Error ? error.message : String(error),
    })
  }

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

  // Force-clear only after paid check — never wipe flags on unpaid/missing rows.
  if (options.forceSupplier) {
    await prisma.order.updateMany({
      where: { id: orderId, status: "paid" },
      data: { merchantSupplierEmailSentAt: null },
    })
    order.merchantSupplierEmailSentAt = null
  }
  if (options.forceAffiliate) {
    await prisma.order.updateMany({
      where: { id: orderId, status: "paid" },
      data: { merchantAffiliateEmailSentAt: null },
    })
    order.merchantAffiliateEmailSentAt = null
  }

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
  const replyTo = resolveSupportEmail()

  if (!order.merchantSupplierEmailSentAt) {
    const supplierEmail = order.supplier.email.trim()
    if (!supplierEmail) {
      console.log("[merchant-order-alerts]", {
        orderId,
        result: "supplier_email_skipped_no_address",
      })
    } else {
      const copy = copyForMerchantNewOrderAlert(emailLocale)
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
        const sendResult = await sendResendEmail({
          context: "merchant-new-order-alert",
          config,
          intendedTo: supplierEmail,
          subject: copy.subject(productName),
          html,
          replyTo,
          tags: merchantAlertTags("supplier", orderId),
        })

        if (!sendResult.ok) {
          console.error("[merchant-order-alerts]", {
            orderId,
            role: "SUPPLIER",
            result: "email_failed",
            error: sendResult.error,
            intendedTo: maskEmailForLog(supplierEmail),
          })
        } else {
          const claimed = await prisma.order.updateMany({
            where: { id: orderId, merchantSupplierEmailSentAt: null },
            data: { merchantSupplierEmailSentAt: new Date() },
          })

          if (claimed.count > 0) {
            console.log("[merchant-order-alerts]", {
              orderId,
              role: "SUPPLIER",
              result: "email_sent",
              resendId: sendResult.resendId,
              intendedTo: maskEmailForLog(supplierEmail),
              forced: Boolean(options.forceSupplier),
            })
          }
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
      const copy = copyForAffiliateNewSaleAlert(emailLocale)
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
        const sendResult = await sendResendEmail({
          context: "affiliate-new-sale-alert",
          config,
          intendedTo: affiliateEmail,
          subject: copy.subject(productName),
          html,
          replyTo,
          tags: merchantAlertTags("affiliate", orderId),
        })

        if (!sendResult.ok) {
          console.error("[merchant-order-alerts]", {
            orderId,
            role: "AFFILIATE",
            result: "email_failed",
            error: sendResult.error,
            intendedTo: maskEmailForLog(affiliateEmail),
          })
        } else {
          const claimed = await prisma.order.updateMany({
            where: { id: orderId, merchantAffiliateEmailSentAt: null },
            data: { merchantAffiliateEmailSentAt: new Date() },
          })

          if (claimed.count > 0) {
            console.log("[merchant-order-alerts]", {
              orderId,
              role: "AFFILIATE",
              result: "email_sent",
              resendId: sendResult.resendId,
              intendedTo: maskEmailForLog(affiliateEmail),
              forced: Boolean(options.forceAffiliate),
            })
          }
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
