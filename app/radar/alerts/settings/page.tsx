import { redirect } from "next/navigation"

import RadarAlertSettingsClient from "@/app/radar/alerts/settings/settings-client"
import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getUserRadarPlan } from "@/lib/radar/plans"
import { getRadarDb } from "@/lib/prisma-radar"

export default async function RadarAlertSettingsPage() {
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
  const slackAccess = checkRadarAccess(planUser, "slack")

  if (!slackAccess.allowed) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-zinc-900">⚙️ Alertes — Slack</h2>
        <RadarPaywallPanel
          plan={plan}
          title="Slack — Radar Global $99/m"
          reason={slackAccess.reason ?? "Slack alerts available on Radar Global"}
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
