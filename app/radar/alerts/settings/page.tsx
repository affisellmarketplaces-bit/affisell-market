import { redirect } from "next/navigation"

import RadarAlertSettingsClient from "@/app/radar/alerts/settings/settings-client"
import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { loadRadarPlanContext } from "@/lib/radar/plan-user.server"
import { getRadarDb } from "@/lib/prisma-radar"

export default async function RadarAlertSettingsPage() {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { planUser, plan } = await loadRadarPlanContext({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro,
    features: session.user.features,
  })
  const slackAccess = checkRadarAccess(planUser, "slack")

  if (!slackAccess.allowed) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-zinc-900">⚙️ Alertes — Slack</h2>
        <RadarPaywallPanel
          plan={plan}
          reason={slackAccess.reason ?? "Slack alerts disponibles sur Radar Global"}
        />
      </div>
    )
  }

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
