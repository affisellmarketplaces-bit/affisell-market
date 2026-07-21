import { SupplierTrustSelfCard } from "@/components/logistics/SupplierTrustSelfCard"
import { SupplierRequestsClient } from "@/components/requests/SupplierRequestsClient"
import { requireSupplierSession } from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"

export default async function SupplierRequestsPage() {
  const session = await requireSupplierSession("/dashboard/supplier/requests")

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto mb-4 max-w-3xl">
        <SupplierTrustSelfCard supplierId={session.user.id} />
      </div>
      <SupplierRequestsClient />
    </main>
  )
}
