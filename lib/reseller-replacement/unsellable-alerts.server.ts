import "server-only"

import { createTranslator } from "next-intl"

import { loadAppMessages } from "@/lib/i18n-load-messages"
import { loadAlertPreference } from "@/lib/intelligence/profit-alerts.server"
import { prisma } from "@/lib/prisma"
import { listingProblem } from "@/lib/reseller-replacement/listing-state"
import {
  planDigests,
  readUnsellableAlertsMode,
  UNSELLABLE_DIGEST_NOTIF,
  UNSELLABLE_LISTING_NOTIF,
  unsellableAlertBucket,
  unsellableAlertId,
  unsellableDigestId,
} from "@/lib/reseller-replacement/unsellable-alerts"
import {
  OBSERVATION_ACTION,
  OBSERVED_MARKER_ACTION,
  observationId,
  observedMarkerId,
  parseObservation,
  summarizeObservation,
  summarizeObservations,
  type ObservationTrend,
  type ObservedItem,
  type UnsellableObservation,
} from "@/lib/reseller-replacement/unsellable-observation"

const BATCH = 500
const MAX_LISTINGS = 5000

export type UnsellableAlertsRun = {
  mode: "off" | "observe" | "enforce"
  scanned: number
  unsellable: number
  /** Bell notifications sent (at most one per reseller and per day). */
  notified: number
  /** Of those, summaries covering several products. */
  digests: number
  alreadyNotified: number
  skippedPreference: number
  /** New listings of resellers already told today: not claimed, told tomorrow. */
  deferredToTomorrow: number
  truncated: boolean
  /** `observe` only: the day's measurement (null when it could not be recorded — the run itself still succeeds). */
  observation?: UnsellableObservation | null
}

/**
 * Daily scan of LIVE listings whose product can not be bought (same rule as the action card and the replacement page).
 * `observe` sends nothing and records only the measurement (`recordObservation`); `enforce` sends AT MOST ONE bell per
 * reseller and per day (`deliverDigests`): the listing's own notice when one product is new, one summary otherwise —
 * each listing still told at most once per problem and 14-day window, gated by the reseller's in-app preference.
 */
export async function runUnsellableListingAlerts(now = new Date()): Promise<UnsellableAlertsRun> {
  const mode = readUnsellableAlertsMode()
  const run: UnsellableAlertsRun = {
    mode,
    scanned: 0,
    unsellable: 0,
    notified: 0,
    digests: 0,
    alreadyNotified: 0,
    skippedPreference: 0,
    deferredToTomorrow: 0,
    truncated: false,
  }
  if (mode === "off") return run

  const found: Array<ObservedItem & { productName: string }> = []
  let cursor: string | undefined
  while (run.scanned < MAX_LISTINGS) {
    const rows = await prisma.affiliateProduct.findMany({
      where: { isListed: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        affiliateId: true,
        product: {
          select: {
            name: true,
            active: true,
            isDraft: true,
            tags: true,
            stock: true,
            hasVariants: true,
            variants: true,
            listingKind: true,
            commissionRate: true,
            offerMode: true,
          },
        },
      },
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id
    run.scanned += rows.length
    for (const r of rows) {
      const problem = listingProblem({ ...r.product, commissionRate: Number(r.product.commissionRate) || 0 })
      if (!problem) continue
      run.unsellable++
      found.push({ affiliateId: r.affiliateId, listingId: r.id, problem, productName: r.product.name })
    }
    if (rows.length < BATCH) break
  }
  run.truncated = run.scanned >= MAX_LISTINGS

  if (mode === "observe") {
    run.observation = await recordObservation(now, run, found)
    console.log("[unsellable-alerts]", {
      result: "would_notify",
      count: run.unsellable,
      wouldNotifyNew: run.observation?.wouldNotifyNew ?? null,
      wouldNotifyResellers: run.observation?.wouldNotifyResellers ?? null,
      scanned: run.scanned,
      truncated: run.truncated,
    })
    return run
  }
  await deliverDigests(now, run, found)
  return run
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002")
}

/**
 * `enforce`: per reseller, the listings not yet told in this 14-day window → claim the reseller's day → claim those
 * listings → ONE bell. Already told today = nothing claimed, the listings wait for tomorrow (never lost, never doubled).
 */
async function deliverDigests(now: Date, run: UnsellableAlertsRun, found: Array<ObservedItem & { productName: string }>) {
  const fresh: typeof found = []
  for (let i = 0; i < found.length; i += 500) {
    const chunk = found.slice(i, i + 500)
    const ids = chunk.map((it) => unsellableAlertId(it.listingId, it.problem, now))
    const existing = new Set((await prisma.auditLog.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id))
    chunk.forEach((it, k) => (existing.has(ids[k]!) ? run.alreadyNotified++ : fresh.push(it)))
  }
  for (const plan of planDigests(fresh)) {
    const pref = await loadAlertPreference(plan.affiliateId)
    if (!pref.inApp) {
      run.skippedPreference += plan.items.length
      continue
    }
    try {
      await prisma.auditLog.create({
        data: {
          id: unsellableDigestId(plan.affiliateId, now),
          action: "affiliate.listing_unsellable_digest",
          entityType: "User",
          entityId: plan.affiliateId,
          actorId: null,
          payload: { count: plan.items.length },
        },
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        run.deferredToTomorrow += plan.items.length
        continue
      }
      throw error
    }
    const claimed = await prisma.auditLog.createMany({
      data: plan.items.map((it) => ({
        id: unsellableAlertId(it.listingId, it.problem, now),
        action: "affiliate.listing_unsellable_alerted",
        entityType: "AffiliateProduct",
        entityId: it.listingId,
        actorId: null,
        payload: { problem: it.problem, digest: plan.kind === "digest" },
      })),
      skipDuplicates: true,
    })
    if (claimed.count === 0) continue
    const t = createTranslator({
      locale: pref.locale,
      messages: loadAppMessages(pref.locale),
      namespace: "affiliate.replacement",
    }) as unknown as (key: string, values?: Record<string, string | number>) => string
    if (plan.kind === "single") {
      const it = plan.items[0]!
      await prisma.notification.create({
        data: {
          userId: plan.affiliateId,
          type: UNSELLABLE_LISTING_NOTIF,
          message: t("bellMessage", { product: it.productName.slice(0, 120) }),
          // the bell builds the link to /dashboard/affiliate/products/<listingId>/replace from this id
          orderId: it.listingId,
        },
      })
    } else {
      await prisma.notification.create({
        data: {
          userId: plan.affiliateId,
          type: UNSELLABLE_DIGEST_NOTIF,
          message: t("digestMessage", { count: plan.items.length }),
        },
      })
      run.digests++
    }
    run.notified++
  }
}

const MARKER_CHUNK = 500

/**
 * `observe` measurement (no notice, no listing, no money): one internal marker per (listing, problem, 14-day window)
 * — its creation means `enforce` would have sent that notice today — and one aggregate row for the day. Never throws:
 * a failed measurement is logged and the run goes on.
 */
async function recordObservation(now: Date, run: UnsellableAlertsRun, items: ObservedItem[]): Promise<UnsellableObservation | null> {
  try {
    const bucket = unsellableAlertBucket(now)
    const newItems: ObservedItem[] = []
    for (let i = 0; i < items.length; i += MARKER_CHUNK) {
      const chunk = items.slice(i, i + MARKER_CHUNK)
      const ids = chunk.map((it) => observedMarkerId(it.listingId, it.problem, bucket))
      const existing = new Set(
        (await prisma.auditLog.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id),
      )
      const fresh = chunk.filter((it, k) => !existing.has(ids[k]!))
      if (fresh.length === 0) continue
      await prisma.auditLog.createMany({
        data: fresh.map((it) => ({
          id: observedMarkerId(it.listingId, it.problem, bucket),
          action: OBSERVED_MARKER_ACTION,
          entityType: "AffiliateProduct",
          entityId: it.listingId,
          actorId: null,
          payload: { problem: it.problem },
        })),
        skipDuplicates: true,
      })
      newItems.push(...fresh)
    }
    // Would the reseller's in-app preference have blocked it? Read once per reseller concerned by a new notice.
    const inAppOff = new Set<string>()
    for (const affiliateId of new Set(newItems.map((it) => it.affiliateId))) {
      const pref = await loadAlertPreference(affiliateId)
      if (!pref.inApp) inAppOff.add(affiliateId)
    }
    const observation = summarizeObservation({ now, scanned: run.scanned, truncated: run.truncated, items, newItems, inAppOff })
    await prisma.auditLog.createMany({
      data: [
        {
          id: observationId(now),
          action: OBSERVATION_ACTION,
          entityType: "UnsellableAlertsObservation",
          entityId: observation.day,
          actorId: null,
          payload: observation,
        },
      ],
      skipDuplicates: true,
    })
    return observation
  } catch (error) {
    console.error("[unsellable-alerts] observation_failed", { error: error instanceof Error ? error.message : "unknown" })
    return null
  }
}

/** READ-ONLY (admin): the daily measurements of the last `days` days and their plain summary. */
export async function loadUnsellableObservations(days = 30): Promise<{ rows: UnsellableObservation[]; trend: ObservationTrend }> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 180) * 86_400_000)
  const raw = await prisma.auditLog.findMany({
    where: { action: OBSERVATION_ACTION, createdAt: { gte: since } },
    select: { payload: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  const rows = raw.map((r) => parseObservation(r.payload)).filter((o): o is UnsellableObservation => o !== null)
  return { rows, trend: summarizeObservations(rows) }
}
