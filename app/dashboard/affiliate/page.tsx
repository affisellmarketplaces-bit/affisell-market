import { redirect } from "next/navigation"
import { Suspense } from "react"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { loadAffiliateDashboardListings } from "@/lib/affiliate-dashboard-data"
import { prisma } from "@/lib/prisma"

import { AffiliateDashboard } from "./affiliate-dashboard"

export const dynamic = "force-dynamic"

export default async function AffiliateDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/affiliate")
  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session.user.role !== "AFFILIATE") redirect("/marketplace")

  const affiliateId = session.user.id

  const [listings, store] = await Promise.all([
    loadAffiliateDashboardListings(affiliateId),
    prisma.store.findUnique({
      where: { userId: affiliateId },
      select: { slug: true },
    }),
  ])

  return (
    <Suspense
      fallback={
        <BentoShell>
          <BentoContainer>
            <BentoCard className="py-12 text-center text-sm text-gray-600 dark:text-zinc-400">
              Loading your dashboard…
            </BentoCard>
          </BentoContainer>
        </BentoShell>
      }
    >
      <AffiliateDashboard
        listings={JSON.parse(JSON.stringify(listings))}
        storeSlug={store?.slug ?? null}
        storeId={affiliateId}
      />
    </Suspense>
  )
}
