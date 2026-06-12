import { requireSupplierSession } from "@/lib/dashboard-session"

import { AffisellPlatformFeesExplainer } from "@/components/shared/affisell-platform-fees-explainer"
import { MerchantPulseHub } from "@/components/merchant/merchant-pulse-hub"
import { MerchantStripeConnectPanel } from "@/components/merchant/merchant-stripe-connect-panel"
import { prisma } from "@/lib/prisma"
import {
  emptySupplierEarningsPulse,
  loadSupplierEarningsPulse,
} from "@/lib/merchant-earnings-pulse"
import { loadOrFallback } from "@/lib/safe-server-data"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function SupplierBalancePage() {
  const session = await requireSupplierSession("/dashboard/supplier/balance")

  const [data, merchantUser, kycProfile] = await Promise.all([
    loadOrFallback(
      "supplier/balance",
      () => loadSupplierEarningsPulse(session.user.id),
      emptySupplierEarningsPulse()
    ),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        supplierFeeBps: true,
        supplierFeeBpsCatalog: true,
        supplierFeeBpsAutoBuy: true,
        stripeAccountId: true,
        stripeOnboardedAt: true,
      },
    }),
    prisma.merchantLegalProfile.findUnique({
      where: { userId: session.user.id },
      select: { verificationStatus: true },
    }),
  ])

  const connectSlot = (
    <Suspense fallback={null}>
      <MerchantStripeConnectPanel
        role="SUPPLIER"
        connectOnboarded={Boolean(merchantUser?.stripeOnboardedAt)}
        stripeAccountId={merchantUser?.stripeAccountId ?? null}
        verificationApproved={kycProfile?.verificationStatus === "APPROVED"}
      />
    </Suspense>
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
      leadingSlot={
        <>
          {connectSlot}
          <AffisellPlatformFeesExplainer variant="supplier" supplierOverrides={merchantUser} />
        </>
      }
    />
  )
}
