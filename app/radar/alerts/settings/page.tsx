import { redirect } from "next/navigation"

import RadarAlertSettingsClient from "@/app/radar/alerts/settings/settings-client"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getRadarDb } from "@/lib/prisma-radar"

export default async function RadarAlertSettingsPage() {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const features = resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) redirect("/pricing")

  let subscriptions: Array<{
    id: string
    channel: string
    active: boolean
    hasWebhook: boolean
    filters: unknown
  }> = []

  if (resolveRadarDatabaseUrl()) {
    try {
      const rows = await getRadarDb().alertSubscription.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      })
      subscriptions = rows.map((s) => ({
        id: s.id,
        channel: s.channel,
        active: s.active,
        hasWebhook: Boolean(s.webhookUrl),
        filters: s.filters,
      }))
    } catch (err) {
      console.warn("[radar/alerts/settings]", {
        result: "db_failed",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  return <RadarAlertSettingsClient subscriptions={subscriptions} />
}
