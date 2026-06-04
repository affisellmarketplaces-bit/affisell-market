import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { RgpdRegistreClient } from "@/components/admin/rgpd-registre-client"
import { RGPD_REGISTRE_ROWS } from "@/lib/admin/rgpd-registre-data"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Registre RGPD | Admin Affisell",
  robots: { index: false, follow: false },
}

const LAST_UPDATED = "2026-06-04"

export default async function AdminRgpdRegistrePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/admin?callbackUrl=/admin/rgpd-registre")
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    redirect("/")
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <RgpdRegistreClient rows={RGPD_REGISTRE_ROWS} lastUpdated={LAST_UPDATED} />
    </main>
  )
}
