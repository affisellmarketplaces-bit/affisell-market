import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { renderOrderInvoicePdf, type InvoiceType } from "@/lib/invoices/order-invoice-pdf"
import {
  resolveAffiliateCommissionnaireSellerName,
  resolveSupplierSellerName,
} from "@/lib/legal/affiliate-commissionnaire.server"
import { affiliateSaleAmountsFromOrder } from "@/lib/legal/affiliate-commissionnaire-shared"
import { ensureCustomerInvoiceNumber } from "@/lib/invoices/invoice-number.server"
import { listingDisplayTitle } from "@/lib/affiliate-listing-display"
import { invoiceAddressLines, resolveInvoiceLocale } from "@/lib/invoices/invoice-labels"
import { resolveOrderAccessRole } from "@/lib/order-access"
import { affisellFeeBaseCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

function parseType(raw: string | null): InvoiceType | null {
  if (raw === "SUPPLIER" || raw === "AFFILIATE" || raw === "CUSTOMER") return raw
  return null
}

export async function GET(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const url = new URL(req.url)
  const type = parseType(url.searchParams.get("type"))
  if (!type) {
    return NextResponse.json({ error: "type=SUPPLIER|AFFILIATE|CUSTOMER required" }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      product: { select: { name: true } },
      affiliateProduct: { select: { customTitle: true } },
      affiliateSale: true,
    },
  })
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const role = resolveOrderAccessRole(order, session.user)
  const allowed =
    (type === "SUPPLIER" && (role === "SUPPLIER" || role === "AFFILIATE")) ||
    (type === "AFFILIATE" && role === "AFFILIATE") ||
    (type === "CUSTOMER" && role === "CUSTOMER")

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [commissionnaireName, supplierName] = await Promise.all([
    resolveAffiliateCommissionnaireSellerName(order.affiliateId),
    resolveSupplierSellerName(order.supplierId),
  ])

  const saleSnapshot = order.affiliateSale
    ? {
        marginAmountCents: order.affiliateSale.marginAmountCents,
        commissionAmountCents: order.affiliateSale.commissionAmountCents,
        resalePriceCents: order.affiliateSale.resalePriceCents,
        pricingFreedom: order.affiliateSale.pricingFreedom,
      }
    : affiliateSaleAmountsFromOrder({
        supplierPriceCents: order.supplierPriceCents,
        affiliateMarginCents: order.affiliateMarginCents,
        affiliatePayoutCents: order.affiliatePayoutCents,
        sellingPriceCents: order.sellingPriceCents,
      })

  const subtotalCents = affisellFeeBaseCentsFromOrder(order)
  const affiliateEarningCents = order.affiliatePayoutCents + order.affiliateMarginRetainedCents

  const pdfInput = {
    orderId: order.id,
    // Buyer document: the clean listing title the buyer saw; supplier/affiliate documents keep the catalogue name.
    productName:
      type === "CUSTOMER"
        ? listingDisplayTitle(order.affiliateProduct?.customTitle, order.product.name)
        : order.product.name,
    createdAt: order.createdAt.toISOString().slice(0, 10),
    supplierPayoutCents: order.supplierPayoutCents,
    affiliateEarningCents: type === "SUPPLIER" ? 0 : affiliateEarningCents,
    // The supplier's document carries wholesale only — no buyer total, resale price, margin or buyer email.
    totalCents: type === "SUPPLIER" ? 0 : (order.totalCents ?? subtotalCents + (order.taxCents ?? 0)),
    subtotalCents: type === "SUPPLIER" ? order.supplierPayoutCents : subtotalCents,
    taxCents: type === "SUPPLIER" ? 0 : order.taxCents ?? 0,
    customerEmail: type === "SUPPLIER" ? "" : order.customerEmail,
    commissionnaireSellerName: commissionnaireName,
    supplierSellerName: supplierName,
    marginAmountCents: type === "SUPPLIER" ? 0 : saleSnapshot.marginAmountCents,
    commissionAmountCents: type === "SUPPLIER" ? 0 : saleSnapshot.commissionAmountCents,
    resalePriceCents: type === "SUPPLIER" ? 0 : saleSnapshot.resalePriceCents,
    pricingFreedom: saleSnapshot.pricingFreedom,
    locale: resolveInvoiceLocale(order.buyerLocale),
    ...(type === "CUSTOMER"
      ? {
          quantity: order.quantity,
          // Unit price as charged (incl. VAT when applicable): paid line / quantity.
          unitPriceCents: Math.round((order.totalCents ?? subtotalCents + (order.taxCents ?? 0)) / Math.max(1, order.quantity)),
          variantLabel: order.variantLabel,
          paidAt: order.paidAt ? order.paidAt.toISOString().slice(0, 10) : null,
          buyerAddressLines: invoiceAddressLines(order.shippingAddress),
          taxRatePercent:
            order.taxRate != null ? (Number(order.taxRate) <= 1 ? Number(order.taxRate) * 100 : Number(order.taxRate)) : null,
        }
      : {}),
  }

  // Continuous invoice number for the customer document. Never blocks the download: without it (e.g. migration not
  // yet applied) the invoice still renders with the order reference.
  let invoiceNumber: string | null = null
  let issuedAt: string | null = null
  if (type === "CUSTOMER") {
    try {
      const stamp = await ensureCustomerInvoiceNumber(order.id)
      invoiceNumber = stamp.number
      issuedAt = stamp.issuedAt.toISOString().slice(0, 10)
    } catch (error) {
      console.error("[invoice-number]", { orderId: order.id, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const pdf = await renderOrderInvoicePdf(type, {
    ...pdfInput,
    ...(type === "CUSTOMER" ? { currency: order.currency, invoiceNumber, issuedAt } : {}),
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="affisell-${type.toLowerCase()}-${order.id.slice(0, 8)}.pdf"`,
    },
  })
}
