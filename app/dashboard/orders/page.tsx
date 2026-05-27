import { redirect } from "next/navigation"
import { requireMerchantSession } from "@/lib/dashboard-session"


export const dynamic = "force-dynamic"

export default async function DashboardOrdersPage() {
  const session = await requireMerchantSession("/dashboard/orders")

  const role = session.user.role
  if (role === "AFFILIATE") redirect("/dashboard/affiliate")
  redirect("/marketplace/account/orders")
}
