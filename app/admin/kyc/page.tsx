import { redirect } from "next/navigation"

import { AdminKycConsole } from "@/components/admin/admin-kyc-console"
import { loadAdminKycQueue } from "@/lib/admin/merchant-kyc/load-kyc-queue"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminKycPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/kyc")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminKycQueue("PENDING_REVIEW")

  return <AdminKycConsole initial={initial} />
}
