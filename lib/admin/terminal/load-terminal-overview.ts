import { loadCheckoutLaunchWaitlistStats } from "@/lib/admin/load-checkout-launch-waitlist-stats"
import { loadExpansionRolloutHealthStats } from "@/lib/admin/load-expansion-rollout-health"
import { loadAdminKycStats } from "@/lib/admin/merchant-kyc/load-kyc-queue"
import { loadMerchantPublishPipelineStats } from "@/lib/supplier-publish-readiness"
import { computeSentinelScore } from "@/lib/sentinel/score"
import type { SentinelSeverity } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

export type TerminalQueueCard = {
  id: string
  label: string
  count: number
  href: string
  tone: "rose" | "amber" | "violet" | "sky" | "emerald"
  hint: string
}

export type TerminalFeedItem = {
  id: string
  kind: "signal" | "ticket" | "return" | "kyc" | "review"
  title: string
  detail: string
  href: string
  at: string
  severity?: string
}

export type AdminTerminalOverview = {
  sentinelScore: number
  scannedAt: string
  queues: TerminalQueueCard[]
  feed: TerminalFeedItem[]
}

export async function loadAdminTerminalOverview(): Promise<AdminTerminalOverview> {
  const [
    kyc,
    publishPipeline,
    launchWaitlist,
    expansionHealth,
    openSignals,
    signalCounts,
    lastScan,
    supportOpen,
    returnsActive,
    reviewsQueue,
    ordersAttention,
    recentTickets,
    recentReturns,
    recentKyc,
    recentSignals,
    recentReviews,
  ] = await Promise.all([
    loadAdminKycStats(),
    loadMerchantPublishPipelineStats(),
    loadCheckoutLaunchWaitlistStats(),
    loadExpansionRolloutHealthStats(),
    prisma.opsSignal.count({ where: { resolvedAt: null } }),
    prisma.opsSignal.groupBy({
      by: ["severity"],
      where: { resolvedAt: null },
      _count: { _all: true },
    }),
    prisma.opsSignal.findFirst({ orderBy: { lastSeenAt: "desc" }, select: { lastSeenAt: true } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.orderReturn.count({
      where: { status: { in: ["REQUESTED", "AWAITING_SHIPMENT", "IN_TRANSIT", "RECEIVED"] } },
    }),
    prisma.review.count({ where: { status: { in: ["PENDING", "AI_FLAGGED"] } } }),
    prisma.order.count({
      where: { fulfillmentStatus: { in: ["FAILED", "MANUAL_REQUIRED"] } },
    }),
    prisma.supportTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.orderReturn.findMany({
      where: { status: { in: ["REQUESTED", "AWAITING_SHIPMENT"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { order: { select: { id: true, customerEmail: true, product: { select: { name: true } } } } },
    }),
    prisma.merchantLegalProfile.findMany({
      where: { verificationStatus: "PENDING_REVIEW" },
      orderBy: { submittedAt: "desc" },
      take: 5,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.opsSignal.findMany({
      where: { resolvedAt: null, severity: { in: ["P0", "P1"] } },
      orderBy: { lastSeenAt: "desc" },
      take: 5,
    }),
    prisma.review.findMany({
      where: { status: { in: ["PENDING", "AI_FLAGGED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { product: { select: { name: true } } },
    }),
  ])

  const openCounts: Record<SentinelSeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const row of signalCounts) {
    const sev = row.severity as SentinelSeverity
    if (sev in openCounts) openCounts[sev] = row._count._all
  }

  const p0 = openCounts.P0

  const queues: TerminalQueueCard[] = [
    {
      id: "sentinel",
      label: "Sentinel",
      count: openSignals,
      href: "/admin/sentinel",
      tone: p0 > 0 ? "rose" : "violet",
      hint: p0 > 0 ? `${p0} signal P0` : "Ops plateforme",
    },
    {
      id: "kyc",
      label: "KYC",
      count: kyc.pending + kyc.needsInfo,
      href: "/admin/kyc",
      tone: kyc.pending > 0 ? "amber" : "emerald",
      hint: `${kyc.pending} en attente`,
    },
    {
      id: "publish-pipeline",
      label: "Publication",
      count: publishPipeline.kycPendingWithDrafts,
      href: "/admin/kyc",
      tone: publishPipeline.kycPendingWithDrafts > 0 ? "amber" : "emerald",
      hint: `${publishPipeline.readyToPublish} prêts · ${publishPipeline.kycPendingWithDrafts} KYC+ brouillon`,
    },
    {
      id: "row-expansion",
      label: "Expansion ROW",
      count: launchWaitlist.total,
      href: "/admin/expansion",
      tone:
        expansionHealth.graduationEmailStallCount > 0 || expansionHealth.stalledCount > 0
          ? "amber"
          : launchWaitlist.total > 0
            ? "sky"
            : "emerald",
      hint:
        expansionHealth.graduationEmailStallCount > 0
          ? `${expansionHealth.graduationEmailStallCount} graduation email(s) stalled 48h+ · ${expansionHealth.graduationEmailStallCountries.join(", ")}`
          : expansionHealth.stalledCount > 0
            ? `${expansionHealth.stalledCount} rollout(s) stalled · ${expansionHealth.stalledCountries.join(", ")}`
          : launchWaitlist.topCountry && launchWaitlist.topCountryCount > 0
            ? `${launchWaitlist.topCountry} · ${launchWaitlist.topCountryCount} alertes`
            : expansionHealth.enabledCount > 0
              ? `${expansionHealth.enabledCount} live · ${expansionHealth.awaitingFirstOrder} awaiting 1st order`
              : "Alertes lancement pays",
    },
    {
      id: "support",
      label: "Support",
      count: supportOpen,
      href: "/admin/support",
      tone: supportOpen > 0 ? "sky" : "emerald",
      hint: "Tickets contact",
    },
    {
      id: "returns",
      label: "Retours",
      count: returnsActive,
      href: "/admin/returns",
      tone: returnsActive > 0 ? "amber" : "emerald",
      hint: "Litiges acheteurs",
    },
    {
      id: "reviews",
      label: "Avis",
      count: reviewsQueue,
      href: "/admin/reviews",
      tone: reviewsQueue > 0 ? "violet" : "emerald",
      hint: "Modération",
    },
    {
      id: "orders",
      label: "Commandes",
      count: ordersAttention,
      href: "/admin/orders",
      tone: ordersAttention > 0 ? "rose" : "violet",
      hint: "Fulfillment bloqué",
    },
  ]

  const feed: TerminalFeedItem[] = [
    ...recentSignals.map((s) => ({
      id: `signal-${s.id}`,
      kind: "signal" as const,
      title: s.title,
      detail: `${s.severity} · ${s.domain}`,
      href: "/admin/sentinel",
      at: s.lastSeenAt.toISOString(),
      severity: s.severity,
    })),
    ...recentTickets.map((t) => ({
      id: `ticket-${t.id}`,
      kind: "ticket" as const,
      title: `#${t.ticketRef} — ${t.subject}`,
      detail: t.email,
      href: "/admin/support",
      at: t.createdAt.toISOString(),
    })),
    ...recentReturns.map((r) => ({
      id: `return-${r.id}`,
      kind: "return" as const,
      title: `Retour · ${r.order.product.name}`,
      detail: `${r.status} · ${r.order.customerEmail ?? "—"}`,
      href: `/admin/orders/${r.order.id}`,
      at: r.createdAt.toISOString(),
    })),
    ...recentKyc.map((p) => ({
      id: `kyc-${p.userId}`,
      kind: "kyc" as const,
      title: p.legalEntityName ?? p.user.name ?? p.user.email,
      detail: p.legalStatus.replace(/_/g, " "),
      href: "/admin/kyc",
      at: p.submittedAt.toISOString(),
    })),
    ...recentReviews.map((r) => ({
      id: `review-${r.id}`,
      kind: "review" as const,
      title: r.product.name,
      detail: r.status,
      href: "/admin/reviews",
      at: r.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 12)

  return {
    sentinelScore: computeSentinelScore(openCounts),
    scannedAt: lastScan?.lastSeenAt.toISOString() ?? new Date().toISOString(),
    queues,
    feed,
  }
}
