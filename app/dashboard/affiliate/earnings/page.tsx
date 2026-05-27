import { requireAffiliateSession } from "@/lib/dashboard-session"

import { MerchantPulseHub } from "@/components/merchant/merchant-pulse-hub"
import {
  emptyAffiliateEarningsPulse,
  loadAffiliateEarningsPulse,
} from "@/lib/merchant-earnings-pulse"
import { loadOrFallback } from "@/lib/safe-server-data"

export const dynamic = "force-dynamic"

export default async function AffiliateEarningsPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/earnings")


  const data = await loadOrFallback(
    "affiliate/earnings",
    () => loadAffiliateEarningsPulse(session.user.id),
    emptyAffiliateEarningsPulse()
  )

  return (
    <MerchantPulseHub
      role="AFFILIATE"
      eyebrow="Partner commerce"
      title="Earnings cockpit"
      description="Commission from your storefront rate plus markup on every sale. Only you and Affisell ops see markup — suppliers never see it."
      paidOutLabel="Paid out via ledger"
      paidOutCents={data.paidOutCents}
      bands={data.bands}
      sparkline={data.sparkline}
      recentLedger={data.recentLedger}
      backHref="/dashboard/affiliate"
    />
  )
}
