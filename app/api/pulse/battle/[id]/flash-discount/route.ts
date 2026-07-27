import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { normalizeBattleFlashDiscount } from "@/lib/pulse/battle-engine"
import {
  findPrimaryListingForProduct,
  resolveListingLowestPrice30dCents,
} from "@/lib/pulse/battle-price-history"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/pulse/battle/[id]/flash-discount
 * Reseller (AFFILIATE owning A/B listing) sets flash % on a live battle.
 * Body: { flashDiscount: number } // 5–50
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
  await ensurePulseBattleSchema()

  const session = await auth()
  const userId = session?.user?.id?.trim() || ""
  const role = String(session?.user?.role ?? "").toUpperCase()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (role !== "AFFILIATE" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: battleId } = await ctx.params
  if (!battleId?.trim()) {
    return NextResponse.json({ error: "battleId required" }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as { flashDiscount?: unknown }
  const raw = Number(body.flashDiscount)
  if (!Number.isFinite(raw) || raw < 5 || raw > 50) {
    return NextResponse.json(
      { error: "flashDiscount must be between 5 and 50" },
      { status: 400 }
    )
  }
  const flashDiscount = normalizeBattleFlashDiscount(raw)

  const battle = await prisma.pulseBattle.findUnique({
    where: { id: battleId },
    select: {
      id: true,
      status: true,
      productAId: true,
      productBId: true,
      flashDiscount: true,
    },
  })
  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 })
  }
  /** Allow live + scheduled so reseller can set % before / during battle (not after end). */
  if (battle.status !== "live" && battle.status !== "scheduled") {
    return NextResponse.json(
      { error: "Battle flash can only be set while scheduled or live" },
      { status: 400 }
    )
  }

  const listingA = await findPrimaryListingForProduct(battle.productAId)
  const listingB = await findPrimaryListingForProduct(battle.productBId)
  const ownsA = listingA?.affiliateId === userId
  const ownsB = listingB?.affiliateId === userId
  if (role !== "ADMIN" && !ownsA && !ownsB) {
    console.log("[pulse-battle/flash-discount]", {
      result: "forbidden_not_owner",
      battleId,
      userId,
    })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const listing = ownsA ? listingA : ownsB ? listingB : listingA ?? listingB
  const currentCents = listing?.sellingPriceCents ?? 0
  const listingId = listing?.id ?? ""
  const ref = listingId
    ? await resolveListingLowestPrice30dCents({
        listingId,
        currentSellingPriceCents: currentCents,
      })
    : { cents: currentCents, source: "listing_current" as const }

  const updated = await prisma.pulseBattle.update({
    where: { id: battle.id },
    data: {
      flashDiscount,
      flashDiscountSetBy: userId,
      priceReferenceCents: ref.cents > 0 ? ref.cents : null,
      priceReferenceSource: ref.source,
    },
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
    },
  })

  console.log("[pulse-battle/flash-discount]", {
    result: "updated",
    battleId: updated.id,
    userId,
    flashDiscount: updated.flashDiscount,
    priceReferenceCents: updated.priceReferenceCents,
    priceReferenceSource: updated.priceReferenceSource,
  })

  return NextResponse.json({ ok: true, battle: updated })
}
