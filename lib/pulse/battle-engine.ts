import { prisma } from "@/lib/prisma"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import {
  BATTLE_DEFAULT_FLASH_PCT,
  BATTLE_DURATION_MS,
  BATTLE_FLASH_MS,
  type BattlePayload,
  type BattleProductCard,
  type BattleVoteChatLine,
  type PulseBattleStatus,
} from "@/lib/pulse/battle-types"

export function normalizeBattleFlashDiscount(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return BATTLE_DEFAULT_FLASH_PCT
  /** Reseller legal band: 5–50% (DGCCRF promo control). */
  return Math.max(5, Math.min(50, n))
}

const productBattleSelect = {
  id: true,
  name: true,
  images: true,
  categories: true,
  basePriceCents: true,
  videoAdUrl: true,
  videos: { select: { videoUrl: true }, take: 1 },
  affiliateProducts: {
    where: { isListed: true },
    orderBy: { conversions: "desc" as const },
    take: 1,
    select: { id: true, sellingPriceCents: true },
  },
} as const

type ProductBattleRow = {
  id: string
  name: string
  images: unknown
  categories: unknown
  basePriceCents: number
  videoAdUrl: string | null
  videos: Array<{ videoUrl: string }>
  affiliateProducts: Array<{ id: string; sellingPriceCents: number }>
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  const u = images.find((x): x is string => typeof x === "string" && Boolean(x.trim()))
  return u?.trim() || null
}

function firstCategory(categories: unknown): string {
  if (!Array.isArray(categories)) return "Marketplace"
  const c = categories.find((x): x is string => typeof x === "string" && Boolean(x.trim()))
  return c?.trim() || "Marketplace"
}

function toCard(p: ProductBattleRow): BattleProductCard {
  const listing = p.affiliateProducts[0]
  return {
    id: p.id,
    name: p.name,
    image: firstImage(p.images),
    videoUrl: p.videoAdUrl?.trim() || p.videos[0]?.videoUrl?.trim() || null,
    priceCents: listing?.sellingPriceCents ?? p.basePriceCents,
    category: firstCategory(p.categories),
    affiliateProductId: listing?.id ?? null,
  }
}

const FAKE_CHAT_NAMES = [
  "Marc",
  "Sophie",
  "Léa",
  "Karim",
  "Nina",
  "Tom",
  "Camille",
  "Yanis",
] as const

function synthesizeChat(
  votes: Array<{ id: string; productId: string; createdAt: Date }>,
  productAId: string,
  nameA: string,
  nameB: string
): BattleVoteChatLine[] {
  const lines: BattleVoteChatLine[] = []
  for (let i = 0; i < Math.min(votes.length, 12); i++) {
    const v = votes[i]!
    const name = FAKE_CHAT_NAMES[i % FAKE_CHAT_NAMES.length]!
    const title = (v.productId === productAId ? nameA : nameB).slice(0, 28)
    const emoji = i % 2 === 0 ? "❤️" : "🔥"
    lines.push({
      id: v.id,
      text: `${name} a voté ${title} ${emoji}`,
      createdAt: v.createdAt.toISOString(),
    })
  }
  // Pad with ambient fake lines when quiet
  if (lines.length < 4) {
    for (let i = lines.length; i < 6; i++) {
      const name = FAKE_CHAT_NAMES[i % FAKE_CHAT_NAMES.length]!
      const side = i % 2 === 0 ? nameA : nameB
      lines.push({
        id: `ambient_${i}`,
        text: `${name} regarde le battle…`,
        createdAt: new Date(Date.now() - i * 20_000).toISOString(),
      })
      void side
    }
  }
  return lines.reverse()
}

type BattleWithProducts = {
  id: string
  productAId: string
  productBId: string
  status: string
  scheduledAt: Date
  startedAt: Date | null
  endedAt: Date | null
  winnerId: string | null
  votesA: number
  votesB: number
  totalVoters: number
  flashDiscount: number
  flashDiscountSetBy?: string | null
  priceReferenceCents?: number | null
  priceReferenceSource?: string | null
  flashEndsAt: Date | null
  productA: ProductBattleRow
  productB: ProductBattleRow
}

function serializeBattle(
  battle: BattleWithProducts,
  alreadyVotedProductId: string | null,
  recentVotes: BattleVoteChatLine[]
): BattlePayload {
  const total = Math.max(0, battle.votesA + battle.votesB)
  const pctA = total > 0 ? Math.round((battle.votesA / total) * 100) : 50
  const pctB = total > 0 ? 100 - pctA : 50
  const now = Date.now()
  const endMs = battle.endedAt ? battle.endedAt.getTime() : now + BATTLE_DURATION_MS
  const flashEndMs = battle.flashEndsAt ? battle.flashEndsAt.getTime() : 0
  const status = battle.status as PulseBattleStatus

  return {
    id: battle.id,
    status,
    scheduledAt: battle.scheduledAt.toISOString(),
    startedAt: battle.startedAt?.toISOString() ?? null,
    endedAt: battle.endedAt?.toISOString() ?? null,
    flashEndsAt: battle.flashEndsAt?.toISOString() ?? null,
    flashDiscount: battle.flashDiscount || BATTLE_DEFAULT_FLASH_PCT,
    flashDiscountSetBy: battle.flashDiscountSetBy ?? null,
    priceReferenceCents: battle.priceReferenceCents ?? null,
    priceReferenceSource: battle.priceReferenceSource ?? null,
    votesA: battle.votesA,
    votesB: battle.votesB,
    totalVoters: battle.totalVoters,
    winnerId: battle.winnerId,
    productA: toCard(battle.productA),
    productB: toCard(battle.productB),
    pctA,
    pctB,
    timeLeftMs: status === "live" ? Math.max(0, endMs - now) : 0,
    flashTimeLeftMs:
      status === "ended" && flashEndMs > now ? Math.max(0, flashEndMs - now) : 0,
    alreadyVotedProductId,
    recentVotes,
  }
}

async function loadBattleVotesChat(battleId: string, productAId: string, nameA: string, nameB: string) {
  const votes = await prisma.pulseBattleVote.findMany({
    where: { battleId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, productId: true, createdAt: true },
  })
  return synthesizeChat(votes, productAId, nameA, nameB)
}

async function findVotedProductId(
  battleId: string,
  userId?: string | null,
  ip?: string | null
): Promise<string | null> {
  if (userId) {
    const row = await prisma.pulseBattleVote.findFirst({
      where: { battleId, userId },
      select: { productId: true },
    })
    return row?.productId ?? null
  }
  if (ip) {
    const row = await prisma.pulseBattleVote.findFirst({
      where: { battleId, ip },
      select: { productId: true },
    })
    return row?.productId ?? null
  }
  return null
}

const includeProducts = {
  productA: { select: productBattleSelect },
  productB: { select: productBattleSelect },
} as const

/**
 * Next 18:00 Europe/Paris (or today 18:00 if still upcoming).
 */
export function nextParisBattleSlot(from = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(from).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  ) as Record<string, string>
  const y = Number(parts.year)
  const m = Number(parts.month)
  const d = Number(parts.day)
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)

  // Approximate: Paris offset from a reference Instant — use noon UTC guess then adjust
  // Build candidate "today 18:00 Paris" via iterative UTC search
  let dayOffset = hour > 18 || (hour === 18 && minute > 0) ? 1 : 0
  for (let attempt = 0; attempt < 3; attempt++) {
    const probeLocal = new Date(Date.UTC(y, m - 1, d + dayOffset, 16, 0, 0)) // 16 UTC ≈ 18 CEST
    const check = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(probeLocal)
    const hp = Object.fromEntries(
      check.filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
    ) as Record<string, string>
    if (Number(hp.hour) === 18 && Number(hp.minute) === 0) {
      if (probeLocal.getTime() <= from.getTime()) {
        dayOffset += 1
        continue
      }
      return probeLocal
    }
    // Adjust hour: if Paris shows 17, add 1h; if 19, subtract 1h
    const delta = 18 - Number(hp.hour)
    const adjusted = new Date(probeLocal.getTime() + delta * 3600_000)
    if (adjusted.getTime() <= from.getTime()) {
      dayOffset += 1
      continue
    }
    return adjusted
  }
  return new Date(from.getTime() + 24 * 3600_000)
}

export async function pickTwoBattleProducts(): Promise<[ProductBattleRow, ProductBattleRow] | null> {
  const tryQuery = async (where: object) =>
    prisma.affiliateProduct.findMany({
      where,
      orderBy: { conversions: "desc" },
      take: 40,
      select: { product: { select: productBattleSelect } },
    })

  let listings = await tryQuery({
    isListed: true,
    product: { active: true, isDraft: false, listingKind: "PHYSICAL" },
  })
  if (listings.length < 2) {
    listings = await tryQuery({
      isListed: true,
      product: { active: true, isDraft: false },
    })
  }
  if (listings.length < 2) {
    listings = await tryQuery({
      product: { active: true },
    })
  }

  const products = listings.map((l) => l.product).filter(Boolean) as ProductBattleRow[]
  if (products.length < 2) return null

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i]!
      const b = products[j]!
      if (a.id === b.id) continue
      const ca = firstCategory(a.categories)
      const cb = firstCategory(b.categories)
      if (ca !== cb || products.length < 4) return [a, b]
    }
  }
  return [products[0]!, products[1]!]
}

/** Create a battle that is immediately live for 15 minutes. */
export async function createLiveBattleNow(
  customFlashDiscount?: number,
  pairOverride?: { productAId: string; productBId: string } | null
) {
  const pair = pairOverride
    ? null
    : await pickTwoBattleProducts()
  const productAId = pairOverride?.productAId ?? pair?.[0]?.id
  const productBId = pairOverride?.productBId ?? pair?.[1]?.id
  if (!productAId || !productBId || productAId === productBId) {
    console.log("[pulse-battle]", { result: "no_products" })
    return null
  }
  const startedAt = new Date()
  const endedAt = new Date(startedAt.getTime() + BATTLE_DURATION_MS)
  const flashDiscount =
    customFlashDiscount != null
      ? normalizeBattleFlashDiscount(customFlashDiscount)
      : BATTLE_DEFAULT_FLASH_PCT
  const battle = await prisma.pulseBattle.create({
    data: {
      productAId,
      productBId,
      status: "live",
      scheduledAt: startedAt,
      startedAt,
      endedAt,
      flashDiscount,
    },
    include: includeProducts,
  })
  console.log("[pulse-battle]", {
    result: "live_bootstrapped",
    battleId: battle.id,
    productAId,
    productBId,
  })
  return battle as unknown as BattleWithProducts
}

export async function createScheduledBattle(
  scheduledAt?: Date,
  customFlashDiscount?: number,
  pairOverride?: { productAId: string; productBId: string } | null
) {
  const pair = pairOverride ? null : await pickTwoBattleProducts()
  const productAId = pairOverride?.productAId ?? pair?.[0]?.id
  const productBId = pairOverride?.productBId ?? pair?.[1]?.id
  if (!productAId || !productBId || productAId === productBId) {
    console.log("[pulse-battle]", { result: "no_products" })
    return null
  }
  const when = scheduledAt ?? nextParisBattleSlot()
  const flashDiscount =
    customFlashDiscount != null
      ? normalizeBattleFlashDiscount(customFlashDiscount)
      : BATTLE_DEFAULT_FLASH_PCT
  const battle = await prisma.pulseBattle.create({
    data: {
      productAId,
      productBId,
      status: "scheduled",
      scheduledAt: when,
      flashDiscount,
    },
    include: includeProducts,
  })
  console.log("[pulse-battle]", {
    result: "scheduled",
    battleId: battle.id,
    scheduledAt: when.toISOString(),
    productAId,
    productBId,
  })
  return battle as unknown as BattleWithProducts
}

export async function endBattle(battleId: string): Promise<string> {
  const battle = await prisma.pulseBattle.findUnique({ where: { id: battleId } })
  if (!battle) throw new Error("BATTLE_NOT_FOUND")
  if (battle.status === "ended" && battle.winnerId) return battle.winnerId

  const winnerId =
    battle.votesA >= battle.votesB ? battle.productAId : battle.productBId
  const now = new Date()
  await prisma.pulseBattle.update({
    where: { id: battleId },
    data: {
      status: "ended",
      winnerId,
      endedAt: now,
      flashEndsAt: new Date(now.getTime() + BATTLE_FLASH_MS),
    },
  })
  console.log("[pulse-battle]", { result: "ended", battleId, winnerId })
  return winnerId
}

async function maybeGoLive(battle: BattleWithProducts): Promise<BattleWithProducts> {
  if (battle.status !== "scheduled") return battle
  if (battle.scheduledAt.getTime() > Date.now()) return battle

  const startedAt = new Date()
  const endedAt = new Date(startedAt.getTime() + BATTLE_DURATION_MS)
  const updated = await prisma.pulseBattle.update({
    where: { id: battle.id },
    data: { status: "live", startedAt, endedAt },
    include: includeProducts,
  })
  console.log("[pulse-battle]", { result: "live", battleId: battle.id })
  return updated as unknown as BattleWithProducts
}

async function maybeEndExpired(battle: BattleWithProducts): Promise<BattleWithProducts> {
  if (battle.status !== "live") return battle
  if (!battle.endedAt || battle.endedAt.getTime() > Date.now()) return battle
  await endBattle(battle.id)
  const refreshed = await prisma.pulseBattle.findUnique({
    where: { id: battle.id },
    include: includeProducts,
  })
  return (refreshed ?? battle) as unknown as BattleWithProducts
}

function isMissingBattleTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const code =
    typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : ""
  return (
    code === "P2021" ||
    code === "P2022" ||
    /PulseBattle|pulseBattle|PriceHistory|does not exist|column .* does not exist|relation .* does not exist/i.test(
      msg
    )
  )
}

export async function getCurrentBattle(opts?: {
  userId?: string | null
  ip?: string | null
}): Promise<BattlePayload> {
  try {
    return await getCurrentBattleInner(opts)
  } catch (e) {
    if (isMissingBattleTable(e)) {
      console.log("[pulse-battle]", {
        result: "table_missing_retry",
        error: e instanceof Error ? e.message : String(e),
      })
      const ok = await ensurePulseBattleSchema()
      if (ok) {
        try {
          return await getCurrentBattleInner(opts)
        } catch (e2) {
          console.log("[pulse-battle]", {
            result: "retry_failed",
            error: e2 instanceof Error ? e2.message : String(e2),
          })
        }
      }
    }
    // Last resort: ephemeral demo from catalog (no votes persisted)
    const demo = await buildEphemeralDemoBattle()
    if (demo) return demo
    throw new Error("NO_BATTLE_PRODUCTS")
  }
}

async function buildEphemeralDemoBattle(): Promise<BattlePayload | null> {
  const pair = await pickTwoBattleProducts().catch(() => null)
  if (!pair) return null
  const [a, b] = pair
  const startedAt = new Date()
  const endedAt = new Date(startedAt.getTime() + BATTLE_DURATION_MS)
  const cardA = toCard(a)
  const cardB = toCard(b)
  console.log("[pulse-battle]", { result: "ephemeral_demo", a: a.id, b: b.id })
  return {
    id: `demo_${a.id}_${b.id}`,
    status: "live",
    scheduledAt: startedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    flashEndsAt: null,
    flashDiscount: BATTLE_DEFAULT_FLASH_PCT,
    flashDiscountSetBy: null,
    priceReferenceCents: null,
    priceReferenceSource: null,
    votesA: 12,
    votesB: 9,
    totalVoters: 21,
    winnerId: null,
    productA: cardA,
    productB: cardB,
    pctA: 57,
    pctB: 43,
    timeLeftMs: BATTLE_DURATION_MS,
    flashTimeLeftMs: 0,
    alreadyVotedProductId: null,
    recentVotes: [
      {
        id: "ambient_0",
        text: `Marc a voté ${cardA.name.slice(0, 24)} ❤️`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "ambient_1",
        text: `Sophie a voté ${cardB.name.slice(0, 24)} 🔥`,
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

async function getCurrentBattleInner(opts?: {
  userId?: string | null
  ip?: string | null
}): Promise<BattlePayload> {
  let battle = (await prisma.pulseBattle.findFirst({
    where: { status: "live" },
    include: includeProducts,
    orderBy: { startedAt: "desc" },
  })) as BattleWithProducts | null

  if (!battle) {
    battle = (await prisma.pulseBattle.findFirst({
      where: { status: "scheduled", scheduledAt: { lte: new Date() } },
      include: includeProducts,
      orderBy: { scheduledAt: "asc" },
    })) as BattleWithProducts | null
  }

  if (!battle) {
    battle = (await prisma.pulseBattle.findFirst({
      where: { status: "scheduled" },
      include: includeProducts,
      orderBy: { scheduledAt: "asc" },
    })) as BattleWithProducts | null
  }

  if (!battle) {
    battle = (await prisma.pulseBattle.findFirst({
      where: {
        status: "ended",
        flashEndsAt: { gt: new Date() },
      },
      include: includeProducts,
      orderBy: { endedAt: "desc" },
    })) as BattleWithProducts | null
  }

  if (!battle) {
    battle = await createLiveBattleNow()
    if (!battle) {
      throw new Error("NO_BATTLE_PRODUCTS")
    }
  }

  battle = await maybeGoLive(battle)
  battle = await maybeEndExpired(battle)

  const alreadyVoted = await findVotedProductId(battle.id, opts?.userId, opts?.ip)
  const chat = await loadBattleVotesChat(
    battle.id,
    battle.productAId,
    battle.productA.name,
    battle.productB.name
  )

  return serializeBattle(battle, alreadyVoted, chat)
}

export type ActiveBattleFlash = {
  battleId: string
  flashDiscount: number
  flashEndsAt: Date
  priceReferenceCents: number | null
  priceReferenceSource: string | null
  flashDiscountSetBy: string | null
}

/** Apply battle flash % to a unit price in cents (floor, min 1¢). */
export function applyBattleFlashUnitCents(
  listUnitCents: number,
  flashDiscountPercent: number
): number {
  const pct = Math.max(0, Math.min(89, Math.round(flashDiscountPercent)))
  const base = Math.max(0, Math.round(listUnitCents))
  if (pct <= 0 || base <= 0) return base
  return Math.max(1, Math.floor(base * (1 - pct / 100)))
}

/**
 * Server-validated Pulse flash offer for a winning product.
 * Returns null when battleId is missing, expired, or product is not the winner.
 */
export async function resolveActiveBattleFlash(args: {
  battleId: string
  winnerProductId: string
}): Promise<ActiveBattleFlash | null> {
  const battleId = args.battleId.trim()
  const winnerProductId = args.winnerProductId.trim()
  if (!battleId || !winnerProductId) return null

  try {
    await ensurePulseBattleSchema()
    const battle = await prisma.pulseBattle.findFirst({
      where: {
        id: battleId,
        winnerId: winnerProductId,
        status: "ended",
        flashEndsAt: { gt: new Date() },
      },
      select: {
        id: true,
        flashDiscount: true,
        flashEndsAt: true,
        priceReferenceCents: true,
        priceReferenceSource: true,
        flashDiscountSetBy: true,
      },
    })
    if (!battle?.flashEndsAt) return null
    const flashDiscount =
      battle.flashDiscount > 0 && battle.flashDiscount < 90
        ? battle.flashDiscount
        : BATTLE_DEFAULT_FLASH_PCT
    return {
      battleId: battle.id,
      flashDiscount,
      flashEndsAt: battle.flashEndsAt,
      priceReferenceCents: battle.priceReferenceCents ?? null,
      priceReferenceSource: battle.priceReferenceSource ?? null,
      flashDiscountSetBy: battle.flashDiscountSetBy ?? null,
    }
  } catch (e) {
    console.log("[pulse-battle]", {
      result: "flash_resolve_failed",
      battleId,
      schemaMissing: isMissingBattleTable(e),
      error: e instanceof Error ? e.message : String(e),
    })
    /** Never crash PDP / checkout — flash is optional. */
    return null
  }
}

export class BattleVoteError extends Error {
  constructor(
    message: "ALREADY_VOTED" | "BATTLE_NOT_LIVE" | "INVALID_PRODUCT" | "BATTLE_NOT_FOUND"
  ) {
    super(message)
    this.name = "BattleVoteError"
  }
}

export async function voteBattle(args: {
  battleId: string
  productId: string
  userId?: string | null
  ip?: string | null
}): Promise<{ votesA: number; votesB: number; totalVoters: number }> {
  if (args.battleId.startsWith("demo_")) {
    throw new BattleVoteError("BATTLE_NOT_FOUND")
  }

  const battle = await prisma.pulseBattle.findUnique({ where: { id: args.battleId } })
  if (!battle) throw new BattleVoteError("BATTLE_NOT_FOUND")
  if (battle.status !== "live") throw new BattleVoteError("BATTLE_NOT_LIVE")
  if (
    args.productId !== battle.productAId &&
    args.productId !== battle.productBId
  ) {
    throw new BattleVoteError("INVALID_PRODUCT")
  }

  if (args.userId) {
    const existing = await prisma.pulseBattleVote.findFirst({
      where: { battleId: args.battleId, userId: args.userId },
    })
    if (existing) throw new BattleVoteError("ALREADY_VOTED")
  } else if (args.ip) {
    const existing = await prisma.pulseBattleVote.findFirst({
      where: { battleId: args.battleId, ip: args.ip },
    })
    if (existing) throw new BattleVoteError("ALREADY_VOTED")
  } else {
    throw new BattleVoteError("ALREADY_VOTED")
  }

  await prisma.$transaction(async (tx) => {
    await tx.pulseBattleVote.create({
      data: {
        battleId: args.battleId,
        productId: args.productId,
        userId: args.userId ?? null,
        ip: args.ip ?? null,
      },
    })
    if (args.productId === battle.productAId) {
      await tx.pulseBattle.update({
        where: { id: args.battleId },
        data: { votesA: { increment: 1 }, totalVoters: { increment: 1 } },
      })
    } else {
      await tx.pulseBattle.update({
        where: { id: args.battleId },
        data: { votesB: { increment: 1 }, totalVoters: { increment: 1 } },
      })
    }
  })

  const updated = await prisma.pulseBattle.findUniqueOrThrow({
    where: { id: args.battleId },
    select: { votesA: true, votesB: true, totalVoters: true },
  })
  console.log("[pulse-battle]", {
    result: "vote",
    battleId: args.battleId,
    productId: args.productId,
    votesA: updated.votesA,
    votesB: updated.votesB,
  })
  return updated
}
