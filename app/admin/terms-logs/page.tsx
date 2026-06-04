import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { TermsLogsClient } from "@/components/admin/terms-logs-client"
import { loadTermsAcceptanceLogsForAdmin } from "@/lib/admin/terms-logs/load-terms-logs"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Journal consentements | Admin Affisell",
  robots: { index: false, follow: false },
}

export default async function AdminTermsLogsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/admin?callbackUrl=/admin/terms-logs")
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    redirect("/")
  }

  const rows = await loadTermsAcceptanceLogsForAdmin()

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <TermsLogsClient rows={rows} totalLoaded={rows.length} />
    </main>
  )
}
