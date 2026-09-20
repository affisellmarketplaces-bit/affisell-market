import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { resendSupplierOrderAlerts } from "@/lib/emails/resend-supplier-order-alerts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Heal missing supplier new-order emails.
 * `Authorization: Bearer ${CRON_SECRET}`
 *
 * Query:
 * - hours=48 (default) lookback on paidAt
 * - force=1 clear merchantSupplierEmailSentAt then resend (may double-email — ops only)
 * - supplierEmail=a@b.com optional filter
 * - dry=1 list candidates without sending
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const hours = Number(req.nextUrl.searchParams.get("hours") ?? "48")
  const force = req.nextUrl.searchParams.get("force") === "1"
  const dry = req.nextUrl.searchParams.get("dry") === "1"
  const supplierEmail = req.nextUrl.searchParams.get("supplierEmail") ?? undefined

  if (dry) {
    const { prisma } = await import("@/lib/prisma")
    const since = new Date(Date.now() - Math.min(168, Math.max(1, hours)) * 3_600_000)
    const rows = await prisma.order.findMany({
      where: {
        status: "paid",
        paidAt: { gte: since },
        ...(force ? {} : { merchantSupplierEmailSentAt: null }),
        ...(supplierEmail
          ? { supplier: { email: { equals: supplierEmail.trim(), mode: "insensitive" } } }
          : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 40,
      select: {
        id: true,
        paidAt: true,
        merchantSupplierEmailSentAt: true,
        supplier: { select: { email: true } },
        product: { select: { name: true } },
      },
    })
    return NextResponse.json({
      dry: true,
      force,
      hours,
      count: rows.length,
      candidates: rows.map((r) => ({
        orderId: r.id,
        paidAt: r.paidAt,
        supplierEmail: r.supplier.email,
        product: r.product.name,
        alreadyMarkedSent: Boolean(r.merchantSupplierEmailSentAt),
      })),
    })
  }

  const result = await resendSupplierOrderAlerts({ hours, force, supplierEmail })
  return NextResponse.json(result)
}
