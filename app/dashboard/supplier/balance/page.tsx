import { requireSupplierSession } from "@/lib/dashboard-session"

import { AffisellPlatformFeesExplainer } from "@/components/shared/affisell-platform-fees-explainer"
import { MerchantPulseHub } from "@/components/merchant/merchant-pulse-hub"
import { prisma } from "@/lib/prisma"
import {
  emptySupplierEarningsPulse,
  loadSupplierEarningsPulse,
} from "@/lib/merchant-earnings-pulse"
import { loadOrFallback } from "@/lib/safe-server-data"

export const dynamic = "force-dynamic"

export default async function SupplierBalancePage() {
  const session = await requireSupplierSession("/dashboard/supplier/balance")


  const data = await loadOrFallback(
    "supplier/balance",
    () => loadSupplierEarningsPulse(session.user.id),
    emptySupplierEarningsPulse()
  )

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
    </div>
  )
}
