import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BattleDiscountSlider } from "@/components/pulse/BattleDiscountSlider"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import {
  findPrimaryListingForProduct,
  resolveListingLowestPrice30dCents,
} from "@/lib/pulse/battle-price-history"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Battle discount — Affisell",
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ id: string }> }

/**
 * Reseller battle detail — set legal flash % (DGCCRF 30d reference).
 * Path: /dashboard/pulse/[id]
 */
export default async function DashboardPulseBattlePage({ params }: PageProps) {
  const session = await requireAffiliateSession("/dashboard/affiliate/hub")
  const { id: battleId } = await params
  if (!battleId?.trim()) notFound()

  await ensurePulseBattleSchema()

  const battle = await prisma.pulseBattle.findUnique({
    where: { id: battleId },
    select: {
      id: true,
      status: true,
      flashDiscount: true,
      flashDiscountSetBy: true,
      priceReferenceCents: true,
      priceReferenceSource: true,
      flashEndsAt: true,
      productAId: true,
      productBId: true,
      productA: { select: { id: true, name: true } },
      productB: { select: { id: true, name: true } },
    },
  })
  if (!battle) notFound()

  const userId = session.user.id
  const role = String(session.user.role ?? "").toUpperCase()
  const listingA = await findPrimaryListingForProduct(battle.productAId)
  const listingB = await findPrimaryListingForProduct(battle.productBId)
  const ownsA = listingA?.affiliateId === userId
  const ownsB = listingB?.affiliateId === userId
  if (role !== "ADMIN" && !ownsA && !ownsB) {
    console.log("[dashboard/pulse]", {
      result: "forbidden_not_owner",
      battleId,
      userId,
    })
    notFound()
  }

  const listing = ownsA ? listingA : ownsB ? listingB : listingA ?? listingB
  const sellingPriceCents = listing?.sellingPriceCents ?? 0
  let priceReferenceCents = battle.priceReferenceCents
  if ((!priceReferenceCents || priceReferenceCents < 1) && listing) {
    const ref = await resolveListingLowestPrice30dCents({
      listingId: listing.id,
      currentSellingPriceCents: listing.sellingPriceCents,
    })
    priceReferenceCents = ref.cents
  }

  const canEdit = battle.status === "live" || battle.status === "scheduled"

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 dark:bg-zinc-950 md:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/dashboard/affiliate/hub"
            className="text-xs font-semibold text-zinc-500 hover:underline"
          >
            ← Hub affiliate
          </Link>
          <h1 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">
            Pulse Battle — discount flash
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {battle.productA.name} vs {battle.productB.name} · statut{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{battle.status}</span>
          </p>
        </div>

        {canEdit ? (
          <BattleDiscountSlider
            battleId={battle.id}
            initialFlashDiscount={battle.flashDiscount}
            sellingPriceCents={sellingPriceCents}
            priceReferenceCents={priceReferenceCents}
          />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Ce battle est terminé — le flash n’est plus modifiable. Dernier % : −
            {battle.flashDiscount}%.
            {battle.flashEndsAt ? (
              <span className="mt-1 block text-xs">
                Flash ends: {battle.flashEndsAt.toISOString()}
              </span>
            ) : null}
          </div>
        )}

        <p className="text-xs text-zinc-500">
          Référence légale source: {battle.priceReferenceSource ?? "lowest_30d"} · battleId{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{battle.id}</code>
        </p>
        <Link
          href="/pulse/battle"
          className="inline-flex text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Voir l’arène Battle →
        </Link>
      </div>
    </main>
  )
}
