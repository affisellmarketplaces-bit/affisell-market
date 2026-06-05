import { redirect } from "next/navigation"

import { AdminSupportConsole } from "@/components/admin/admin-support-console"
import { loadAdminSupportQueue } from "@/lib/admin/support/load-support-queue"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminSupportPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/support")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminSupportQueue("active")

  return <AdminSupportConsole initial={initial} />
}
