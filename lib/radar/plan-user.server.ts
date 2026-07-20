import type { Session } from "next-auth"

import { prisma } from "@/lib/prisma"
import { getUserRadarPlan, toRadarPlanUser, type RadarPlan, type RadarPlanUser } from "@/lib/radar/plans"

type SessionUser = NonNullable<Session["user"]> & { id: string }

/**
 * Resolve Radar entitlements from DB (`User.radarPlan`) + session JWT.
 * DB wins over stale JWT so paywall lifts immediately after Stripe webhook.
 */
export async function loadRadarPlanContext(user: SessionUser): Promise<{
  planUser: RadarPlanUser
  plan: RadarPlan
}> {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { radarPlan: true, isPro: true, email: true },
  })

  const planUser = toRadarPlanUser(
    {
      id: user.id,
      email: user.email ?? row?.email ?? null,
      role: user.role,
      isPro: row?.isPro ?? user.isPro ?? false,
      features: user.features,
    },
    { subscriptionTiers: row?.radarPlan ? [row.radarPlan] : [] }
  )

  return { planUser, plan: getUserRadarPlan(planUser) }
}
