import Link from "next/link"
import { redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { LightningPayoutSettings } from "@/components/supplier/lightning-payout-settings"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { calculateTrustScoreBreakdown } from "@/lib/trust-score"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function SupplierPayoutSettingsPage() {
  const session = await requireSupplierSession("/dashboard/supplier/settings/payouts")

  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER") {
    redirect("/dashboard/supplier")
  }

  const supplierId = session.user.id
  const breakdown = await calculateTrustScoreBreakdown(supplierId)

  const profile = await prisma.supplierProfile.upsert({
    where: { userId: supplierId },
    create: {
      userId: supplierId,
      trustScore: breakdown.score,
      lightningEnabled: false,
    },
    update: { trustScore: breakdown.score },
    select: { trustScore: true, lightningEnabled: true },
  })

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-6 py-10">
        <div>
          <Link
            href="/dashboard/supplier/balance"
            className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
          >
            ← Balance & reversements
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Paramètres de payout
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Lightning Payout, score de confiance et éligibilité aux reversements instantanés.
          </p>
        </div>

        <LightningPayoutSettings
          initialTrustScore={profile.trustScore}
          initialLightningEnabled={profile.lightningEnabled}
        />

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">Comment mon score est calculé</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs sm:text-sm">
            <li>+20 — Stripe Connect actif (charges activées)</li>
            <li>+30 — plus de 10 commandes payées et taux de litige &lt; 5 %</li>
            <li>+50 — 10 derniers numéros de suivi validés via AfterShip</li>
          </ul>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
