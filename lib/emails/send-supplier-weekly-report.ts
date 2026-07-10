import "server-only"

import { SupplierWeeklyReportEmail } from "@/emails/supplier-weekly-report"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { publicAbsoluteUrl } from "@/lib/public-app-url"
import { getSupplierAnalytics } from "@/lib/supplier-dashboard-analytics"
import { prisma } from "@/lib/prisma"

function displayName(name: string | null, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split("@")[0] ?? "partenaire"
}

function weekBounds(now = new Date()): { start: Date; end: Date; label: string; key: string } {
  const end = now
  const start = new Date(now.getTime() - 7 * 86_400_000)
  const label = `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`
  const key = start.toISOString().slice(0, 10)
  return { start, end, label, key }
}

function buildActionTip(args: {
  revenueCents: number
  zeroSalesAlert: boolean
  topSkuOrders: number
}): string {
  if (args.revenueCents === 0 && args.zeroSalesAlert) {
    return "Baisse ton prix wholesale de 10% sur les SKU sans vente ou ajoute une vidéo — les affiliés convertissent mieux."
  }
  if (args.topSkuOrders === 0) {
    return "Publie au moins 3 SKU complémentaires pour élargir la surface d'attaque affiliée."
  }
  return "Augmente la commission de 2 pts sur ton top SKU pour débloquer 2–3 affiliés supplémentaires cette semaine."
}

export async function sendSupplierWeeklyReportEmail(args: {
  supplierId: string
  email: string
  name: string | null
  now?: Date
}): Promise<
  | { ok: true; resendId?: string; duplicate?: boolean }
  | { ok: false; error: string; skipped?: boolean }
> {
  const now = args.now ?? new Date()
  const { label, key } = weekBounds(now)
  const webhookId = `supplier-weekly-report:${args.supplierId}:${key}`

  const existing = await prisma.processedWebhook.findUnique({ where: { id: webhookId } })
  if (existing) {
    return { ok: true, duplicate: true }
  }

  const [analytics, skuCount, weekRevenueAgg] = await Promise.all([
    getSupplierAnalytics(args.supplierId, now),
    prisma.product.count({
      where: { supplierId: args.supplierId, active: true, isDraft: false },
    }),
    prisma.order.aggregate({
      where: {
        supplierId: args.supplierId,
        status: { in: ["paid", "preparing", "shipped", "delivered"] },
        createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000), lte: now },
      },
      _sum: { supplierPayoutCents: true },
    }),
  ])

  const weekRevenueCents = weekRevenueAgg._sum.supplierPayoutCents ?? 0
  if (weekRevenueCents <= 0 && skuCount <= 0) {
    await prisma.processedWebhook.create({
      data: { id: webhookId, status: "skipped_no_activity" },
    })
    return { ok: false, error: "no_activity", skipped: true }
  }

  const topAffiliate = analytics.topAffiliates[0]
  const topSku = analytics.skuPerformance[0]
  const revenueLabel = formatStoreCurrencyFromCents(Math.max(weekRevenueCents, 0))

  const sent = await sendResendReactEmail({
    context: "supplier-weekly-report",
    intendedTo: args.email,
    subject: `Ton rapport Affisell : ${revenueLabel} cette semaine 📊`,
    template: SupplierWeeklyReportEmail,
    props: {
      name: displayName(args.name, args.email),
      weekLabel: label,
      revenueLabel,
      topAffiliateName: topAffiliate?.displayName ?? "—",
      topAffiliateRevenueLabel: topAffiliate
        ? formatStoreCurrencyFromCents(topAffiliate.revenueCents)
        : "0 €",
      topSkuName: topSku?.productName ?? "—",
      topSkuEpcLabel: topSku ? formatStoreCurrencyFromCents(topSku.epcCents) : "0 €",
      actionTip: buildActionTip({
        revenueCents: weekRevenueCents,
        zeroSalesAlert: analytics.zeroSalesAlert,
        topSkuOrders: topSku?.orders ?? 0,
      }),
      dashboardUrl: publicAbsoluteUrl("/dashboard/supplier"),
    },
  })

  if (!sent.ok) {
    console.log("[supplier-weekly-report]", {
      supplierId: args.supplierId,
      result: "send_failed",
      error: sent.error,
    })
    return { ok: false, error: sent.error }
  }

  await prisma.processedWebhook.create({
    data: {
      id: webhookId,
      status: "success",
      error: sent.resendId ? `resend:${sent.resendId}` : null,
    },
  })

  console.log("[supplier-weekly-report]", {
    supplierId: args.supplierId,
    weekRevenueCents,
    resendId: sent.resendId,
    result: "sent",
  })

  return { ok: true, resendId: sent.resendId }
}

export type RunSupplierWeeklyReportCronResult = {
  processed: number
  sent: number
  skipped: number
  duplicates: number
  errors: string[]
}

export async function runSupplierWeeklyReportCron(
  limit = 80,
  now = new Date()
): Promise<RunSupplierWeeklyReportCronResult> {
  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    take: limit,
    select: { id: true, email: true, name: true },
  })

  let processed = 0
  let sent = 0
  let skipped = 0
  let duplicates = 0
  const errors: string[] = []

  for (const supplier of suppliers) {
    processed += 1
    const result = await sendSupplierWeeklyReportEmail({
      supplierId: supplier.id,
      email: supplier.email,
      name: supplier.name,
      now,
    })

    if (result.ok) {
      if (result.duplicate) duplicates += 1
      else sent += 1
      continue
    }

    if (result.skipped) {
      skipped += 1
      continue
    }

    errors.push(`${supplier.id}:${result.error}`)
  }

  console.log("[supplier-weekly-report-cron]", {
    processed,
    sent,
    skipped,
    duplicates,
    errors: errors.length,
    result: "ok",
  })

  return { processed, sent, skipped, duplicates, errors }
}
