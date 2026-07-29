import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import {
  applyResellerBattleContender,
  loadOwnedBattleListing,
  pickBattlePairWithPreferred,
} from "@/lib/pulse/battle-contender"
import {
  createLiveBattleNow,
  createScheduledBattle,
  nextParisBattleSlot,
  normalizeBattleFlashDiscount,
} from "@/lib/pulse/battle-engine"
import {
  findPrimaryListingForProduct,
  resolveListingLowestPrice30dCents,
} from "@/lib/pulse/battle-price-history"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import { prisma } from "@/lib/prisma"

async function resolveFlashLegalFields(args: {
  userId: string | null
  productAId: string
  productBId: string
  listingId?: string | null
}) {
  if (args.userId && args.listingId) {
    const listing = await loadOwnedBattleListing(args.userId, args.listingId)
    if (listing) {
      const ref = await resolveListingLowestPrice30dCents({
        listingId: listing.listingId,
        currentSellingPriceCents: listing.sellingPriceCents,
      })
      return {
        flashDiscountSetBy: args.userId,
        priceReferenceCents: ref.cents > 0 ? ref.cents : null,
        priceReferenceSource: ref.source,
      }
    }
  }

  const listingA = await findPrimaryListingForProduct(args.productAId)
  const listingB = await findPrimaryListingForProduct(args.productBId)
  const preferred =
    (args.userId && listingA?.affiliateId === args.userId ? listingA : null) ??
    (args.userId && listingB?.affiliateId === args.userId ? listingB : null) ??
    listingA ??
    listingB
  if (!preferred) {
    return {
      flashDiscountSetBy: args.userId,
      priceReferenceCents: null as number | null,
      priceReferenceSource: "listing_current" as const,
    }
  }
  const ref = await resolveListingLowestPrice30dCents({
    listingId: preferred.id,
    currentSellingPriceCents: preferred.sellingPriceCents,
  })
  return {
    flashDiscountSetBy: args.userId,
    priceReferenceCents: ref.cents > 0 ? ref.cents : null,
    priceReferenceSource: ref.source,
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET|POST /api/pulse/battle/create — schedule tomorrow 18h Paris battle.
 * Auth: Bearer CRON_SECRET (Vercel cron 16:00 UTC ≈ 18h Paris).
 * Query `?live=1` also bootstraps an immediate live battle (ops / first deploy).
 * Affiliate POST body may include `listingId` to anchor their product as contender.
 */
async function handle(req: Request) {
  const cronDenied = authorizeCronRequest(req)
  const isCronAuthorized = cronDenied === null
  let setterUserId: string | null = null

  if (!isCronAuthorized) {
    if (req.method !== "POST") return cronDenied
    const session = await auth()
    const role = String(session?.user?.role ?? "").toUpperCase()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (role !== "AFFILIATE" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    setterUserId = session.user.id.trim()
  }

  await ensurePulseBattleSchema()

  const url = new URL(req.url)
  const body =
    req.method === "POST"
      ? ((await req.json().catch(() => ({}))) as {
          live?: boolean
          flashDiscount?: number
          listingId?: string
        })
      : {}
  const wantLive = url.searchParams.get("live") === "1" || body.live === true
  const flashDiscount = normalizeBattleFlashDiscount(
    body.flashDiscount != null ? body.flashDiscount : 20
  )

  const listingIdRaw =
    typeof body.listingId === "string" ? body.listingId.trim() : ""
  let preferredProductId: string | null = null
  let pairOverride: { productAId: string; productBId: string } | null = null

  if (listingIdRaw && setterUserId) {
    const owned = await loadOwnedBattleListing(setterUserId, listingIdRaw)
    if (!owned) {
      return NextResponse.json(
        { error: "Listing introuvable ou non listé" },
        { status: 404 }
      )
    }
    preferredProductId = owned.productId
    pairOverride = await pickBattlePairWithPreferred(owned.productId)
    if (!pairOverride) {
      return NextResponse.json(
        { ok: false, error: "NO_BATTLE_PRODUCTS" },
        { status: 503 }
      )
    }
  }

  let liveId: string | null = null
  if (wantLive) {
    const existingLive = await prisma.pulseBattle.findFirst({
      where: { status: "live" },
      select: { id: true, productAId: true, productBId: true },
    })
    if (existingLive) {
      if (listingIdRaw && setterUserId) {
        const applied = await applyResellerBattleContender({
          battleId: existingLive.id,
          userId: setterUserId,
          listingId: listingIdRaw,
        })
        if (!applied.ok) {
          return NextResponse.json(
            { error: applied.error },
            { status: applied.status }
          )
        }
        await prisma.pulseBattle.update({
          where: { id: existingLive.id },
          data: { flashDiscount },
        })
        liveId = existingLive.id
      } else {
        const legal = await resolveFlashLegalFields({
          userId: setterUserId,
          productAId: existingLive.productAId,
          productBId: existingLive.productBId,
          listingId: listingIdRaw || null,
        })
        await prisma.pulseBattle.update({
          where: { id: existingLive.id },
          data: { flashDiscount, ...legal },
        })
        liveId = existingLive.id
      }
    } else {
      const live = await createLiveBattleNow(flashDiscount, pairOverride)
      liveId = live?.id ?? null
      if (live && setterUserId) {
        if (listingIdRaw) {
          const applied = await applyResellerBattleContender({
            battleId: live.id,
            userId: setterUserId,
            listingId: listingIdRaw,
          })
          if (!applied.ok) {
            console.log("[pulse-battle/create]", {
              result: "contender_after_live_failed",
              error: applied.error,
            })
          }
        } else {
          const legal = await resolveFlashLegalFields({
            userId: setterUserId,
            productAId: live.productAId,
            productBId: live.productBId,
          })
          await prisma.pulseBattle.update({
            where: { id: live.id },
            data: legal,
          })
        }
      }
    }
  }

  const slot = nextParisBattleSlot()
  const existing = await prisma.pulseBattle.findFirst({
    where: {
      status: "scheduled",
      scheduledAt: {
        gte: new Date(slot.getTime() - 2 * 3600_000),
        lte: new Date(slot.getTime() + 2 * 3600_000),
      },
    },
    select: { id: true, scheduledAt: true, productAId: true, productBId: true },
  })
  if (existing) {
    if (listingIdRaw && setterUserId) {
      const applied = await applyResellerBattleContender({
        battleId: existing.id,
        userId: setterUserId,
        listingId: listingIdRaw,
      })
      if (!applied.ok) {
        return NextResponse.json(
          { error: applied.error },
          { status: applied.status }
        )
      }
    }
    const legal = await resolveFlashLegalFields({
      userId: setterUserId,
      productAId: existing.productAId,
      productBId: existing.productBId,
      listingId: listingIdRaw || null,
    })
    const updated = await prisma.pulseBattle.update({
      where: { id: existing.id },
      data: { flashDiscount, ...legal },
      select: { id: true, scheduledAt: true, flashDiscount: true },
    })
    console.log("[pulse-battle/create]", {
      result: "idempotent_update",
      battleId: updated.id,
      liveId,
      flashDiscount: updated.flashDiscount,
      listingId: listingIdRaw || null,
      preferredProductId,
    })
    return NextResponse.json({
      ok: true,
      skipped: true,
      battleId: updated.id,
      liveId,
      flashDiscount: updated.flashDiscount,
      scheduledAt: updated.scheduledAt.toISOString(),
      listingId: listingIdRaw || null,
    })
  }

  const battle = await createScheduledBattle(slot, flashDiscount, pairOverride)
  if (!battle && !liveId) {
    return NextResponse.json({ ok: false, error: "NO_BATTLE_PRODUCTS" }, { status: 503 })
  }
  if (battle && setterUserId) {
    if (listingIdRaw) {
      const applied = await applyResellerBattleContender({
        battleId: battle.id,
        userId: setterUserId,
        listingId: listingIdRaw,
      })
      if (!applied.ok) {
        console.log("[pulse-battle/create]", {
          result: "contender_after_schedule_failed",
          error: applied.error,
        })
      }
    } else {
      const legal = await resolveFlashLegalFields({
        userId: setterUserId,
        productAId: battle.productAId,
        productBId: battle.productBId,
      })
      await prisma.pulseBattle.update({
        where: { id: battle.id },
        data: legal,
      })
    }
  }
  return NextResponse.json({
    ok: true,
    battleId: battle?.id ?? null,
    liveId,
    flashDiscount,
    scheduledAt: battle?.scheduledAt.toISOString() ?? null,
    listingId: listingIdRaw || null,
  })
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
