import { redirect } from "next/navigation"

import { AdminReturnsConsole } from "@/components/admin/admin-returns-console"
import { loadAdminReturnsQueue } from "@/lib/admin/returns/load-returns-queue"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminReturnsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/returns")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminReturnsQueue("active")

  return <AdminReturnsConsole initial={initial} />
}
