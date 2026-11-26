import { redirect } from "next/navigation"

import { AdminLayoutChrome } from "@/components/admin/admin-layout-chrome"
import { IntlScope } from "@/components/providers/intl-scope"
import { auth } from "@/auth"
import { adminNavSessionFromAuth } from "@/lib/admin/admin-nav-session"
import { PRIVATE_SURFACE_NAMESPACES } from "@/lib/i18n-client-scope"

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

  // The root layout only sends public namespaces (lib/i18n-client-scope.ts): add the private ones here.
  return (
    <IntlScope namespaces={PRIVATE_SURFACE_NAMESPACES}>
      <AdminLayoutChrome session={navSession}>{children}</AdminLayoutChrome>
    </IntlScope>
  )
}
