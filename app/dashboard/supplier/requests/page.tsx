import { requireSupplierSession } from "@/lib/dashboard-session"

import { SupplierRequestsClient } from "@/components/requests/SupplierRequestsClient"

export const dynamic = "force-dynamic"

export default async function SupplierRequestsPage() {
  await requireSupplierSession("/dashboard/supplier/requests")

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <SupplierRequestsClient />
    </main>
  )
}
