import { redirect } from "next/navigation"

import { AdminExpansionConsole } from "@/components/admin/admin-expansion-console"
import { loadAdminExpansionOverview } from "@/lib/admin/load-admin-expansion-overview"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminExpansionPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/expansion")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminExpansionOverview()

  return <AdminExpansionConsole initial={initial} />
}
