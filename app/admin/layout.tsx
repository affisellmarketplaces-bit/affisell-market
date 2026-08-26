import { redirect } from "next/navigation"

import { AdminLayoutChrome } from "@/components/admin/admin-layout-chrome"
import { auth } from "@/auth"
import { adminNavSessionFromAuth } from "@/lib/admin/admin-nav-session"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/admin?callbackUrl=/admin/auto-fulfill")
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    redirect("/")
  }

  const navSession = adminNavSessionFromAuth(session)
  if (!navSession) {
    redirect("/login/admin?callbackUrl=/admin/auto-fulfill")
  }

  return <AdminLayoutChrome session={navSession}>{children}</AdminLayoutChrome>
}
