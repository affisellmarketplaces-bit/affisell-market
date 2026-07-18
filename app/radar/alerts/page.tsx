import Link from "next/link"
import { redirect } from "next/navigation"
import type { Prisma } from ".prisma/client-mi"

import RadarAlertsClient from "@/app/radar/alerts/alerts-client"
import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getUserRadarPlan } from "@/lib/radar/plans"
import { getRadarDb } from "@/lib/prisma-radar"

export default async function RadarAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; type?: string }>
}) {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const planUser = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro ?? false,
    features: session.user.features,
  }
  const plan = getUserRadarPlan(planUser)
  const alertsAccess = checkRadarAccess(planUser, "alerts")
  const slackAccess = checkRadarAccess(planUser, "slack")

  if (!alertsAccess.allowed) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-zinc-900">🚨 Alertes Radar</h2>
        <RadarPaywallPanel
          plan={plan}
          title="Alertes réservées Pro+"
          reason={alertsAccess.reason ?? "Upgrade to Pro for Radar alerts"}
        />
      </div>
    )
  }

  const params = await searchParams
  const severityFilter = params.severity?.trim() || "all"
  const typeFilter = params.type?.trim() || "all"

  if (!resolveRadarDatabaseUrl()) {
    return (
      <div className="space-y-4">
        {!slackAccess.allowed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Slack dispo en Global $99/m —{" "}
            <Link href="/pricing?feature=radar" className="font-semibold underline">
              upgrade
            </Link>
          </div>
        )}
        <RadarAlertsClient
          initialAlerts={[]}
          unreadCount={0}
          severityFilter={severityFilter}
          typeFilter={typeFilter}
        />
      </div>
    )
  }

  const where: Prisma.RadarAlertWhereInput = {
    OR: [{ userId: null }, { userId: session.user.id }],
  }
  if (severityFilter !== "all") where.severity = severityFilter
  if (typeFilter !== "all") where.type = typeFilter

  const db = getRadarDb()
  const [alerts, unreadCount] = await Promise.all([
    db.radarAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(50, Math.max(plan.maxAlerts, 10)),
    }),
    db.radarAlert.count({
      where: {
        OR: [{ userId: null }, { userId: session.user.id }],
        read: false,
      },
    }),
  ])

  return (
    <div className="space-y-4">
      {!slackAccess.allowed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Slack dispo en Global $99/m —{" "}
          <Link href="/pricing?feature=radar" className="font-semibold underline">
            upgrade
          </Link>
          {" · "}
          <Link href="/radar/alerts/settings" className="underline">
            settings
          </Link>
        </div>
      )}
      <RadarAlertsClient
        initialAlerts={alerts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        unreadCount={unreadCount}
        severityFilter={severityFilter}
        typeFilter={typeFilter}
      />
    </div>
  )
}
