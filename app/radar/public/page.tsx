import { redirect } from "next/navigation"

import RadarMarketingLanding from "@/components/radar/radar-marketing-landing"
import { auth } from "@/lib/auth"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getUserRadarPlan } from "@/lib/radar/plans"

/** Alias marketing — /radar/public → landing or app. */
export default async function RadarPublicPage() {
  if (!isRadarEnabled()) redirect("/404")

  const session = await auth()
  if (session?.user?.id) {
    const plan = getUserRadarPlan({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      isPro: session.user.isPro ?? false,
      features: session.user.features,
    })
    const access = checkRadarAccess(
      {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        isPro: session.user.isPro ?? false,
        features: session.user.features,
      },
      "dashboard"
    )
    if (access.allowed && plan.id !== "free" && plan.id !== "starter") {
      redirect("/radar")
    }
  }

  return <RadarMarketingLanding />
}
