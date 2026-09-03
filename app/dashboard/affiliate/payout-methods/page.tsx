import { Suspense } from "react"

import { PayoutMethodsGrid } from "@/components/affiliate/PayoutMethodsGrid"
import { PayoutMethodsPageClient } from "@/components/affiliate/payout-methods-page-client"
import PayoutMethodsSkeleton from "@/components/skeletons/PayoutMethodsSkeleton"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { FLAGS } from "@/lib/flags"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

async function PayoutMethodsList() {
  const session = await requireAffiliateSession("/dashboard/affiliate/payout-methods")

  const methods = await prisma.affiliatePayoutMethod.findMany({
    where: { affiliateId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      country: true,
      isDefault: true,
      status: true,
      last4: true,
    },
  })

  if (methods.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-gray-50/50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Aucune méthode de paiement
        </h3>
        <p className="mt-2 text-gray-500 dark:text-zinc-400">
          Ajoute PayPal, virement ou Wave pour recevoir tes commissions.
        </p>
        <div className="mt-6 flex justify-center">
          <PayoutMethodsPageClient />
        </div>
      </div>
    )
  }

  return <PayoutMethodsGrid methods={methods} showAddDrawer />
}

export default async function AffiliatePayoutMethodsPage() {
  if (!FLAGS.AFFILIATE_MULTI_PAYOUT) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Méthodes de paiement
          </h1>
          <p className="mt-1 text-gray-500 dark:text-zinc-400">
            Gère comment tu reçois tes commissions d&apos;affilié. Chiffré de bout en bout.
          </p>
        </div>
        <PayoutMethodsPageClient />
      </div>
      <Suspense fallback={<PayoutMethodsSkeleton />}>
        <PayoutMethodsList />
      </Suspense>
    </div>
  )
}
