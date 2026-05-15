import { redirect } from "next/navigation"

import { MerchantPulseHub } from "@/components/merchant/merchant-pulse-hub"
import { auth } from "@/auth"
import { loadAffiliateEarningsPulse } from "@/lib/merchant-earnings-pulse"

export const dynamic = "force-dynamic"

export default async function AffiliateEarningsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/affiliate/earnings")
  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session.user.role !== "AFFILIATE") redirect("/marketplace")

  const data = await loadAffiliateEarningsPulse(session.user.id)

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
