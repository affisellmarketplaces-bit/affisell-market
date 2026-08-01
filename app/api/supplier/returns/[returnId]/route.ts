import { auth } from "@/auth"
import { reverseBuyerRewardEarnOnRefund } from "@/lib/buyer-reward-ledger"
import { initiateMarketplaceRefundPipeline } from "@/lib/marketplace-refund-pipeline"
import { prisma } from "@/lib/prisma"
import { supplierActionToNextStatus } from "@/lib/order-return-state"
import {
  assertNoSupplierRetailLeak,
  supplierReturnLiabilityCents,
} from "@/lib/supplier-retail-veil"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ORDER_SETTLEMENT_SELECT = {
  id: true,
  sellingPriceCents: true,
  basePriceCents: true,
  supplierPriceCents: true,
  supplierPayoutCents: true,
  supplierCommissionRateBps: true,
  usesAffisellAutoBuy: true,
  supplierFeeCents: true,
  aeWholesaleCents: true,
  affiliatePayoutCents: true,
  product: { select: { name: true } },
} as const

export async function PATCH(req: Request, ctx: { params: Promise<{ returnId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { returnId } = await ctx.params
  if (!returnId) {
    return Response.json({ error: "Missing return id" }, { status: 400 })
  }

  let body: {
    action?: string
    sellerNote?: string
    rejectionReason?: string
    /** Ignored — suppliers must never set/see buyer retail refund €. */
    approvedRefundCents?: number
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const action = body.action as "approve" | "reject" | "mark_received" | "mark_refunded" | undefined
  if (
    action !== "approve" &&
    action !== "reject" &&
    action !== "mark_received" &&
    action !== "mark_refunded"
  ) {
    return Response.json({ error: "Invalid action" }, { status: 400 })
  }

  const ret = await prisma.orderReturn.findFirst({
    where: { id: returnId, order: { supplierId: session.user.id } },
    include: {
      order: { select: ORDER_SETTLEMENT_SELECT },
    },
  })

  if (!ret) {
    return Response.json({ error: "Return not found" }, { status: 404 })
  }

  const next = supplierActionToNextStatus(ret.status, action)
  if (!next) {
    return Response.json({ error: "Action not allowed for this status" }, { status: 400 })
  }

  const sellerNote =
    typeof body.sellerNote === "string" ? body.sellerNote.trim().slice(0, 2000) : undefined

  if (action === "reject") {
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 2000) : ""
    if (rejectionReason.length < 4) {
      return Response.json({ error: "rejectionReason is required when rejecting" }, { status: 400 })
    }
    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: next,
        rejectionReason,
        sellerNote: sellerNote || null,
      },
    })
    const payload = { id: updated.id, status: updated.status }
    assertNoSupplierRetailLeak(payload)
    return Response.json(payload)
  }

  if (action === "approve") {
    // Buyer retail amount stays server-side (Stripe / rewards). Ignore client body.
    const approved = Math.max(
      0,
      Math.min(ret.requestedRefundCents, ret.order.sellingPriceCents)
    )

    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: next,
        approvedRefundCents: approved,
        sellerNote: sellerNote || null,
      },
    })

    const supplierLiabilityCents = supplierReturnLiabilityCents({
      order: ret.order,
      buyerRefundCents: approved,
      buyerSellCents: ret.order.sellingPriceCents,
    })

    const payload = {
      id: updated.id,
      status: updated.status,
      supplierLiabilityCents,
      hasApprovedRefund: true,
    }
    assertNoSupplierRetailLeak(payload)
    console.log("[supplier-returns]", {
      returnId,
      action: "approve",
      supplierLiabilityCents,
      result: "ok",
    })
    return Response.json(payload)
  }

  if (action === "mark_received") {
    const updated = await prisma.orderReturn.update({
      where: { id: returnId },
      data: {
        status: next,
        receivedAt: new Date(),
        sellerNote: sellerNote ?? ret.sellerNote,
      },
    })
    const payload = {
      id: updated.id,
      status: updated.status,
      receivedAt: updated.receivedAt,
    }
    assertNoSupplierRetailLeak(payload)
    return Response.json(payload)
  }

  const updated = await prisma.orderReturn.update({
    where: { id: returnId },
    data: {
      status: next,
      refundedAt: new Date(),
      sellerNote: sellerNote ?? ret.sellerNote,
    },
  })

  if (updated.status === "REFUNDED") {
    const sell = Math.max(1, ret.order.sellingPriceCents)
    const approved =
      updated.approvedRefundCents ?? ret.approvedRefundCents ?? ret.requestedRefundCents
    const frac = Math.min(1, Math.max(0, approved / sell))
    await reverseBuyerRewardEarnOnRefund(prisma, {
      orderId: ret.orderId,
      refundFraction: frac,
    })

    const refund = await initiateMarketplaceRefundPipeline({
      orderId: ret.orderId,
      source: "supplier_mark_refunded",
      amountCents: approved,
      reason: "requested_by_customer",
      metadata: { returnId },
    })

    if (!refund.ok && refund.skipped !== "already_refunded") {
      return Response.json(
        { error: refund.error ?? "stripe_refund_failed", returnId: updated.id },
        { status: 502 }
      )
    }
  }

  const supplierLiabilityCents = supplierReturnLiabilityCents({
    order: ret.order,
    buyerRefundCents:
      updated.approvedRefundCents ?? ret.approvedRefundCents ?? ret.requestedRefundCents,
    buyerSellCents: ret.order.sellingPriceCents,
  })

  const payload = {
    id: updated.id,
    status: updated.status,
    refundedAt: updated.refundedAt,
    supplierLiabilityCents,
  }
  assertNoSupplierRetailLeak(payload)
  return Response.json(payload)
}
