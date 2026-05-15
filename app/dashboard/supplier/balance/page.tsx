import { redirect } from "next/navigation"

import { MerchantPulseHub } from "@/components/merchant/merchant-pulse-hub"
import { auth } from "@/auth"
import { loadSupplierEarningsPulse } from "@/lib/merchant-earnings-pulse"

export const dynamic = "force-dynamic"

export default async function SupplierBalancePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/supplier/balance")
  if (session.user.role !== "SUPPLIER") redirect("/dashboard")

  const data = await loadSupplierEarningsPulse(session.user.id)

  return (
    <MerchantPulseHub
      role="SUPPLIER"
      eyebrow="Wholesale operations"
      title="Balance & sales pulse"
      description="Track units and wholesale value across marketplace and blind dropship. Payout lines appear when delivery rules release funds."
      paidOutLabel="Paid out via ledger"
      paidOutCents={data.paidOutCents}
      bands={data.bands}
      sparkline={data.sparkline}
      recentLedger={data.recentLedger}
      backHref="/dashboard/supplier"
    />
  )
}
