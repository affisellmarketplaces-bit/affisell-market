import { prisma } from "@/lib/prisma"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import {
  BATTLE_DURATION_MS,
} from "@/lib/pulse/battle-types"
import type {
  BattlesHubCard,
  BattlesHubPayload,
  BattlesHubProduct,
} from "@/lib/battles-hub-types"

const productSelect = {
  id: true,
  name: true,
  images: true,
  basePriceCents: true,
  affiliateProducts: {
    where: { isListed: true },
    orderBy: { conversions: "desc" as const },
    take: 1,
    select: { id: true, sellingPriceCents: true },
  },
} as const

type ProductRow = {
  id: string
  name: string
  images: unknown
  basePriceCents: number
  affiliateProducts: Array<{ id: string; sellingPriceCents: number }>
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  const u = images.find((x): x is string => typeof x === "string" && Boolean(x.trim()))
  return u?.trim() || null
}

function toProduct(p: ProductRow): BattlesHubProduct {
  const listing = p.affiliateProducts[0]
  return {
    id: p.id,
    name: p.name,
    image: firstImage(p.images),
    priceCents: listing?.sellingPriceCents ?? p.basePriceCents,
    affiliateProductId: listing?.id ?? null,
  }
}

function toCard(row: {
  id: string
  status: string
  flashDiscount: number
  votesA: number
  votesB: number
  totalVoters: number
  winnerId: string | null
  scheduledAt: Date
  startedAt: Date | null
  endedAt: Date | null
  flashEndsAt: Date | null
  productA: ProductRow
  productB: ProductRow
}): BattlesHubCard {
  const total = Math.max(0, row.votesA + row.votesB)
  const pctA = total > 0 ? Math.round((row.votesA / total) * 100) : 50
  const pctB = total > 0 ? 100 - pctA : 50
  const now = Date.now()
  const endMs = row.endedAt ? row.endedAt.getTime() : now + BATTLE_DURATION_MS
  const flashEndMs = row.flashEndsAt ? row.flashEndsAt.getTime() : 0
  const status = row.status as BattlesHubCard["status"]

  return {
    id: row.id,
    status,
    flashDiscount: row.flashDiscount || 20,
    votesA: row.votesA,
    votesB: row.votesB,
    totalVoters: row.totalVoters,
    winnerId: row.winnerId,
    scheduledAt: row.scheduledAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    flashEndsAt: row.flashEndsAt?.toISOString() ?? null,
    timeLeftMs: status === "live" ? Math.max(0, endMs - now) : 0,
    flashTimeLeftMs:
      status === "ended" && flashEndMs > now ? Math.max(0, flashEndMs - now) : 0,
    productA: toProduct(row.productA),
    productB: toProduct(row.productB),
    pctA,
    pctB,
  }
}

const includeProducts = {
  productA: { select: productSelect },
  productB: { select: productSelect },
} as const

/**
 * Buyer hub payload — read-only, never auto-creates battles (unlike getCurrentBattle).
 */
export async function loadBattlesHub(): Promise<BattlesHubPayload> {
  await ensurePulseBattleSchema()

  const now = new Date()

  try {
    const [liveRow, upcomingRows, recentRows] = await Promise.all([
      prisma.pulseBattle.findFirst({
        where: { status: "live" },
        orderBy: { startedAt: "desc" },
        include: includeProducts,
      }),
      prisma.pulseBattle.findMany({
        where: {
          status: "scheduled",
          scheduledAt: { gt: now },
        },
        orderBy: { scheduledAt: "asc" },
        take: 6,
        include: includeProducts,
      }),
      prisma.pulseBattle.findMany({
        where: { status: "ended" },
        orderBy: { endedAt: "desc" },
        take: 12,
        include: includeProducts,
      }),
    ])

    /** Prefer flash-active ended battle as "live" card when no live duel. */
    let live: BattlesHubCard | null = liveRow ? toCard(liveRow) : null
    if (!live) {
      const flash = await prisma.pulseBattle.findFirst({
        where: {
          status: "ended",
          flashEndsAt: { gt: now },
        },
        orderBy: { flashEndsAt: "desc" },
        include: includeProducts,
      })
      if (flash) live = toCard(flash)
    }

    const liveId = live?.id
    const recent = recentRows
      .filter((r) => r.id !== liveId)
      .map(toCard)

    console.log("[battles-hub]", {
      result: "loaded",
      live: live?.id ?? null,
      upcoming: upcomingRows.length,
      recent: recent.length,
    })

    return {
      live,
      upcoming: upcomingRows.map(toCard),
      recent,
      generatedAt: new Date().toISOString(),
    }
  } catch (e) {
    console.log("[battles-hub]", {
      result: "load_failed",
      error: e instanceof Error ? e.message : String(e),
    })
    return {
      live: null,
      upcoming: [],
      recent: [],
      generatedAt: new Date().toISOString(),
    }
  }
}
