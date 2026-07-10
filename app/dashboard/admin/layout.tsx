import { redirect } from "next/navigation"

import { AdminNav } from "@/components/admin/admin-nav"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function DashboardAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/admin?callbackUrl=/dashboard/admin/leads")
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    redirect("/")
  }

  return (
    <>
      <AdminNav />
      {children}
    </>
  )
}
