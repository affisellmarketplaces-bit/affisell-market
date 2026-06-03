import { redirect } from "next/navigation"

import { SentinelDashboardClient } from "@/app/admin/sentinel/sentinel-dashboard-client"
import { auth } from "@/auth"
import { loadSentinelDashboard } from "@/lib/sentinel/load-dashboard"

export const dynamic = "force-dynamic"

export default async function AdminSentinelPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/sentinel")

  const dashboard = await loadSentinelDashboard()

  return <SentinelDashboardClient initial={dashboard} />
}
