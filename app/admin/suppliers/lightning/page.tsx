import { redirect } from "next/navigation"

import { AdminLightningSuppliersClient } from "@/components/admin/admin-lightning-suppliers-client"
import { loadAdminLightningSuppliers } from "@/lib/admin/suppliers/load-lightning-suppliers"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminLightningSuppliersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/suppliers/lightning")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminLightningSuppliers()

  return <AdminLightningSuppliersClient initial={initial} />
}
