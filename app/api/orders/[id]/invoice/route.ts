import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { renderOrderInvoicePdf, type InvoiceType } from "@/lib/invoices/order-invoice-pdf"
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
    include: { product: { select: { name: true } } },
  })
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const role = resolveOrderAccessRole(order, session.user)
  const allowed =
    (type === "SUPPLIER" && role === "SUPPLIER") ||
    (type === "AFFILIATE" && role === "AFFILIATE") ||
    (type === "CUSTOMER" && role === "CUSTOMER")

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const subtotalCents = affisellFeeBaseCentsFromOrder(order)
  const pdf = await renderOrderInvoicePdf(type, {
    orderId: order.id,
    productName: order.product.name,
    createdAt: order.createdAt.toISOString().slice(0, 10),
    supplierPayoutCents: order.supplierPayoutCents,
    affiliateEarningCents: order.affiliatePayoutCents + order.affiliateMarginRetainedCents,
    totalCents: order.totalCents ?? subtotalCents + (order.taxCents ?? 0),
    subtotalCents,
    taxCents: order.taxCents ?? 0,
    customerEmail: order.customerEmail,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="affisell-${type.toLowerCase()}-${order.id.slice(0, 8)}.pdf"`,
    },
  })
}
