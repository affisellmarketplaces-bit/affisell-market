import "server-only"

import type { Prisma } from ".prisma/client-mi"

import { ALERT_RULES } from "@/lib/radar/alerts/rules"
import type {
  AlertType,
  RadarAlertInput,
  SnapshotLike,
} from "@/lib/radar/alerts/types"
import { normalizeTitle } from "@/lib/radar/alerts/types"
import { getTrendingKeywords } from "@/lib/radar/google/trends-watcher"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { getRadarDb } from "@/lib/prisma-radar"

const DAY_MS = 24 * 60 * 60 * 1000
const TREND_SEEDS = ["led strip", "shapewear", "phone case", "beauty", "electronics"]

function minSeverityFromEnv(): string {
  return (process.env.RADAR_ALERT_MIN_SEVERITY?.trim() || "medium").toLowerCase()
}

const SEV_ORDER = ["low", "medium", "high", "critical"] as const

function meetsMinSeverity(severity: string): boolean {
  const min = minSeverityFromEnv()
  const minIdx = SEV_ORDER.indexOf(min as (typeof SEV_ORDER)[number])
  const sevIdx = SEV_ORDER.indexOf(severity as (typeof SEV_ORDER)[number])
  if (minIdx < 0 || sevIdx < 0) return true
  return sevIdx >= minIdx
}

async function hasRecentDuplicate(input: {
  type: AlertType
  externalId: string | null
  marketplaceId: string
}): Promise<boolean> {
  if (!input.externalId) return false
  const since = new Date(Date.now() - DAY_MS)
  const existing = await getRadarDb().radarAlert.findFirst({
    where: {
      type: input.type,
      externalId: input.externalId,
      marketplaceId: input.marketplaceId,
      createdAt: { gte: since },
    },
    select: { id: true },
  })
  return Boolean(existing)
}

async function countSaturationSellers(current: SnapshotLike): Promise<number> {
  const since = new Date(Date.now() - 2 * DAY_MS)
  const norm = normalizeTitle(current.title)
  if (!norm) return 0

  const rows = await getRadarDb().radarGlobalSnapshot.findMany({
    where: {
      marketplaceId: current.marketplaceId,
      country: current.country,
      crawledAt: { gte: since },
    },
    select: { externalId: true, title: true },
    take: 500,
  })

  const ids = new Set<string>()
  for (const row of rows) {
    if (normalizeTitle(row.title) === norm) {
      ids.add(row.externalId)
    }
  }
  return ids.size
}

export async function evaluateProduct(
  current: SnapshotLike,
  history: SnapshotLike[],
  opts?: {
    saturationSellerCount?: number
    trendingKeywords?: string[]
  }
): Promise<RadarAlertInput[]> {
  const saturationSellerCount =
    opts?.saturationSellerCount ?? (await countSaturationSellers(current))
  const trendingKeywords = opts?.trendingKeywords ?? []

  const out: RadarAlertInput[] = []

  for (const rule of ALERT_RULES) {
    const result = rule.check({
      current,
      history,
      saturationSellerCount,
      trendingKeywords,
    })
    if (!result?.triggered) continue
    if (!meetsMinSeverity(result.severity)) continue

    const duplicate = await hasRecentDuplicate({
      type: rule.type,
      externalId: current.externalId,
      marketplaceId: current.marketplaceId,
    })
    if (duplicate) {
      console.log("[radar/alerts]", {
        result: "deduped",
        type: rule.type,
        externalId: current.externalId,
        marketplaceId: current.marketplaceId,
      })
      continue
    }

    out.push({
      userId: null,
      type: rule.type,
      severity: result.severity,
      title: result.title,
      message: result.message,
      productId: current.id,
      externalId: current.externalId,
      marketplaceId: current.marketplaceId,
      country: current.country,
      category: current.category,
      meta: result.meta,
    })
  }

  return out
}

export async function evaluateGlobalScan(): Promise<{
  scanned: number
  alerts: number
  createdIds: string[]
}> {
  if (!resolveRadarDatabaseUrl()) {
    console.log("[radar/alerts]", { result: "skipped_no_db" })
    return { scanned: 0, alerts: 0, createdIds: [] }
  }

  const db = getRadarDb()
  const since = new Date(Date.now() - DAY_MS)

  const recent = await db.radarGlobalSnapshot.findMany({
    where: { crawledAt: { gte: since } },
    orderBy: { crawledAt: "desc" },
    take: 1000,
  })

  const trending = await getTrendingKeywords(TREND_SEEDS).catch(() => [])
  const trendingKeywords = trending.map((t) => t.keyword)

  const toCreate: Prisma.RadarAlertCreateManyInput[] = []
  const seenKeys = new Set<string>()

  for (const current of recent) {
    const history = await db.radarGlobalSnapshot.findMany({
      where: {
        marketplaceId: current.marketplaceId,
        externalId: current.externalId,
        country: current.country,
      },
      orderBy: [{ day: "desc" }, { crawledAt: "desc" }],
      take: 20,
    })

    const inputs = await evaluateProduct(current, history, { trendingKeywords })
    for (const input of inputs) {
      const key = `${input.type}:${input.externalId}:${input.marketplaceId}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      toCreate.push({
        userId: input.userId ?? null,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        productId: input.productId,
        externalId: input.externalId,
        marketplaceId: input.marketplaceId,
        country: input.country,
        category: input.category,
        meta: input.meta as Prisma.InputJsonValue,
        read: false,
      })
    }
  }

  const createdIds: string[] = []
  if (toCreate.length > 0) {
    // createMany does not return ids on Postgres — create sequentially for fan-out
    for (const row of toCreate) {
      const created = await db.radarAlert.create({ data: row })
      createdIds.push(created.id)
    }
  }

  console.log("[radar/alerts]", {
    result: "evaluate_done",
    scanned: recent.length,
    alerts: createdIds.length,
  })

  return { scanned: recent.length, alerts: createdIds.length, createdIds }
}
