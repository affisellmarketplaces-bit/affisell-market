import { redirect } from "next/navigation"

import { ProvidersPageClient } from "@/app/admin/providers/providers-page-client"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function ProvidersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/providers")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ProvidersPageClient />
    </main>
  )
}
