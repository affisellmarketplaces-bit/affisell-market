import { redirect } from "next/navigation"

import { AdminAutoBuyAuthorizationsClient } from "@/components/admin/admin-auto-buy-authorizations-client"
import { loadAdminAutoBuyAuthorizations } from "@/lib/admin/suppliers/load-auto-buy-authorizations"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminAutoBuyAuthorizationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/suppliers/auto-buy")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminAutoBuyAuthorizations()

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminAutoBuyAuthorizationsClient initial={initial} />
    </main>
  )
}
