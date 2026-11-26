import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AdminProcurementDebitsConsole } from "@/components/admin/admin-procurement-debits-console"

export const dynamic = "force-dynamic"

/** ADMIN — register of money REALLY debited for source purchases, and its reconciliation with orders. Records only. */
export default async function AdminProcurementDebitsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/procurement-debits")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")
  return <AdminProcurementDebitsConsole />
}
