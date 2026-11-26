import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AdminResellerImportsConsole } from "@/components/admin/admin-reseller-imports-console"
import { listResellerImportsForReview } from "@/lib/reseller-import/review.server"

export const dynamic = "force-dynamic"

/** ADMIN — reseller URL imports: verify, then approve (publish + list) or reject (draft + unlist). */
export default async function AdminResellerImportsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/reseller-imports")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const rows = await listResellerImportsForReview(200)
  return <AdminResellerImportsConsole initialRows={rows} />
}
