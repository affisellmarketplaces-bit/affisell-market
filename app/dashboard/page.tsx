import { redirect } from "next/navigation"
import { requireMerchantSession } from "@/lib/dashboard-session"


export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardRootPage() {
  const session = await requireMerchantSession("/dashboard")
  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")
  redirect("/dashboard/affiliate")
}
