import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { renderOrderInvoicePdf, type InvoiceType } from "@/lib/invoices/order-invoice-pdf"
import {
  resolveAffiliateCommissionnaireSellerName,
  resolveSupplierSellerName,
} from "@/lib/legal/affiliate-commissionnaire.server"
import { affiliateSaleAmountsFromOrder } from "@/lib/legal/affiliate-commissionnaire-shared"
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
    productName: order.product.name,
    createdAt: order.createdAt.toISOString().slice(0, 10),
    supplierPayoutCents: order.supplierPayoutCents,
    affiliateEarningCents,
    totalCents: order.totalCents ?? subtotalCents + (order.taxCents ?? 0),
    subtotalCents: type === "SUPPLIER" ? order.supplierPayoutCents : subtotalCents,
    taxCents: type === "SUPPLIER" ? 0 : order.taxCents ?? 0,
    customerEmail: order.customerEmail,
    commissionnaireSellerName: commissionnaireName,
    supplierSellerName: supplierName,
    marginAmountCents: saleSnapshot.marginAmountCents,
    commissionAmountCents: saleSnapshot.commissionAmountCents,
    resalePriceCents: saleSnapshot.resalePriceCents,
    pricingFreedom: saleSnapshot.pricingFreedom,
    locale: (order.buyerLocale?.startsWith("en") ? "en" : "fr") as "fr" | "en",
  }

  const pdf = await renderOrderInvoicePdf(type, pdfInput)

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="affisell-${type.toLowerCase()}-${order.id.slice(0, 8)}.pdf"`,
    },
  })
}
