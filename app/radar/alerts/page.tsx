import { redirect } from "next/navigation"
import type { Prisma } from ".prisma/client-mi"

import RadarAlertsClient from "@/app/radar/alerts/alerts-client"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getRadarDb } from "@/lib/prisma-radar"

export default async function RadarAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; type?: string }>
}) {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const features = resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) redirect("/pricing")

  const params = await searchParams
  const severityFilter = params.severity?.trim() || "all"
  const typeFilter = params.type?.trim() || "all"

  if (!resolveRadarDatabaseUrl()) {
    return (
      <RadarAlertsClient
        initialAlerts={[]}
        unreadCount={0}
        severityFilter={severityFilter}
        typeFilter={typeFilter}
      />
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
      take: 50,
    }),
    db.radarAlert.count({
      where: {
        OR: [{ userId: null }, { userId: session.user.id }],
        read: false,
      },
    }),
  ])

  return (
    <RadarAlertsClient
      initialAlerts={alerts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))}
      unreadCount={unreadCount}
      severityFilter={severityFilter}
      typeFilter={typeFilter}
    />
  )
}
