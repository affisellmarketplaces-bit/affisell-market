import { requireAffiliateSession } from "@/lib/dashboard-session"
import { Suspense } from "react"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"

import { AffiliateDashboard } from "./affiliate-dashboard"

export const dynamic = "force-dynamic"

/** No Prisma on SSR — hosted DB may block queries when transfer quota is exceeded. */
export default async function AffiliateDashboardPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate")


  return (
    <Suspense
      fallback={
        <BentoShell>
          <BentoContainer>
            <BentoCard className="py-12 text-center text-sm text-gray-600 dark:text-zinc-300">
              Loading your dashboard…
            </BentoCard>
          </BentoContainer>
        </BentoShell>
      }
    >
      <AffiliateDashboard storeId={session.user.id} />
    </Suspense>
  )
}
