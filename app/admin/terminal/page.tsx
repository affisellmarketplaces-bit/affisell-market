import { redirect } from "next/navigation"

import { AdminTerminalHub } from "@/components/admin/admin-terminal-hub"
import { loadAdminTerminalOverview } from "@/lib/admin/terminal/load-terminal-overview"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminTerminalPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/terminal")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminTerminalOverview()

  return <AdminTerminalHub initial={initial} />
}
