import "server-only"

import { createTranslator } from "next-intl"

import { isStockUnconfirmed, STOCK_UNCONFIRMED_KEY } from "@/lib/import-stock"
import { isAppLocale } from "@/lib/i18n-locale"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import { prisma } from "@/lib/prisma"
import { commercialHolds, parseSuspensionState, suspensionStateId } from "@/lib/products/affisell-suspension"
import { mayListOnProduct } from "@/lib/reseller-import/review"
import { availableUnits } from "@/lib/reseller-replacement/listing-state"
import { productHasExplicitSupplierCommission } from "@/lib/supplier-explicit-commission"
import {
  BLOCKED_DEMAND_OBSERVATION_ACTION,
  BLOCKED_DEMAND_OBSERVED_ACTION,
  blockedDemandAlertId,
  blockedDemandObservationId,
  DEFAULT_SUPPLIER_ALERT_PREFERENCE,
  digestIsObsolete,
  EPISODE_STATE_ACTION,
  episodeStateId,
  nextEpisode,
  parseEpisodeState,
  parseSupplierAlertPreference,
  planSupplierNotices,
  qualifyBlockedDemand,
  rankAlerts,
  readSupplierBlockedDemandMode,
  REFERENCE_DAYS,
  SUPPLIER_ALERT_PREF_ACTION,
  SUPPLIER_BLOCKED_DEMAND_NOTIF,
  supplierAlertPreferenceId,
  supplierDigestId,
  summarizeBlockedDemand,
  type BlockedDemandAlert,
  type BlockedDemandObservation,
  type EpisodeState,
  type SupplierAlertPreference,
  qualifyFailedLines,
  sessionBase,
  unavailabilityCause,
  type FailedLineTrace,
  type SupplierNotice,
  type UnavailabilityCause,
} from "@/lib/supplier-demand-alerts/blocked-demand"
import { isPreventiveAlert, stockoutRiskAlertId, stockoutRiskObservedId } from "@/lib/supplier-catalog-health/stockout-forecast"
import { loadStockoutForecasts, type StockoutForecastItem } from "@/lib/supplier-catalog-health/stockout-forecast.server"
import { UNALLOCATED_LINE_AUDIT_ACTION } from "@/lib/unallocated-line"

const DAY = 86_400_000
const MAX_PRODUCTS = 5_000
const LOOKBACK_DAYS = 120


type ProductRow = {
  id: string
  name: string
  supplierId: string
  active: boolean
  isDraft: boolean
  tags: string[]
  stock: number
  hasVariants: boolean
  variants: unknown
  listingKind: string | null
  commissionRate: unknown
  offerMode: string | null
  attributes: Array<{ key: string; value: string | null }>
}

type Snapshot = {
  products: Array<{ row: ProductRow; cause: UnavailabilityCause | null; listings: number }>
  states: Map<string, EpisodeState>
  truncated: boolean
}

/** Every product currently in ≥ 1 live reseller listing (optionally one supplier's), with its cause. READ-ONLY. */
async function snapshot(supplierId: string | null): Promise<Snapshot> {
  const listed = await prisma.affiliateProduct.groupBy({
    by: ["productId"],
    where: { isListed: true, ...(supplierId ? { product: { supplierId } } : {}) },
    _count: { _all: true },
  })
  const truncated = listed.length > MAX_PRODUCTS
  const listings = new Map(listed.slice(0, MAX_PRODUCTS).map((l) => [l.productId, l._count._all]))
  const ids = [...listings.keys()]
  if (ids.length === 0) return { products: [], states: new Map(), truncated }
  const [rows, recalls, suspensions, stateRows] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        supplierId: true,
        active: true,
        isDraft: true,
        tags: true,
        stock: true,
        hasVariants: true,
        variants: true,
        listingKind: true,
        commissionRate: true,
        offerMode: true,
        attributes: { where: { key: STOCK_UNCONFIRMED_KEY }, select: { key: true, value: true } },
      },
    }),
    prisma.productRecall.findMany({ where: { productId: { in: ids } }, select: { productId: true, status: true } }).catch(() => null),
    prisma.auditLog.findMany({ where: { id: { in: ids.map(suspensionStateId) } }, select: { id: true, payload: true } }).catch(() => null),
    prisma.auditLog.findMany({ where: { id: { in: ids.map(episodeStateId) } }, select: { id: true, payload: true } }),
  ])
  const holdsReadable = recalls !== null && suspensions !== null
  const recallsBy = new Map<string, string[]>()
  for (const r of recalls ?? []) recallsBy.set(r.productId, [...(recallsBy.get(r.productId) ?? []), r.status])
  const suspBy = new Map((suspensions ?? []).map((s) => [s.id, s.payload]))
  const states = new Map<string, EpisodeState>()
  for (const s of stateRows) {
    const st = parseEpisodeState(s.payload)
    if (st) states.set(s.id, st)
  }
  const products = (rows as ProductRow[]).map((row) => {
    const susp = suspBy.get(suspensionStateId(row.id))
    const holds = holdsReadable
      ? commercialHolds({ recallStatuses: recallsBy.get(row.id) ?? [], suspension: susp ? parseSuspensionState(susp) : null })
      : null
    const cause = causeOf(row, holds)
    return { row, cause, listings: listings.get(row.id) ?? 0 }
  })
  return { products, states, truncated }
}

function causeOf(row: ProductRow, holds: string[] | null): UnavailabilityCause | null {
  return unavailabilityCause({
    holds,
    awaitingReview: !mayListOnProduct({ active: true, isDraft: false, tags: row.tags }),
    stockUnconfirmed: isStockUnconfirmed(row.attributes),
    active: row.active,
    isDraft: row.isDraft,
    hasExplicitCommission: productHasExplicitSupplierCommission({
      commissionRate: Number(row.commissionRate) || 0,
      variants: row.variants,
      offerMode: row.offerMode,
    }),
    availableUnits: availableUnits(row),
  })
}

/** Observed demand of the unavailable products: paid orders and QUALIFIED failed paid lines. READ-ONLY. */
async function demandFacts(productIds: string[], sinceOf: Map<string, Date | null>, now: Date) {
  const from = new Date(now.getTime() - LOOKBACK_DAYS * DAY)
  const [orders, last, failed] = await Promise.all([
    productIds.length
      ? prisma.order.findMany({
          where: { productId: { in: productIds }, paidAt: { gte: from } },
          select: { productId: true, paidAt: true, stripeSessionId: true },
          take: 100_000,
        })
      : [],
    productIds.length
      ? prisma.order.groupBy({ by: ["productId"], where: { productId: { in: productIds }, paidAt: { not: null } }, _max: { paidAt: true } })
      : [],
    productIds.length
      ? prisma.auditLog.findMany({
          where: { action: UNALLOCATED_LINE_AUDIT_ACTION, createdAt: { gte: from } },
          select: { payload: true, createdAt: true },
          take: 20_000,
        })
      : [],
  ])
  const set = new Set(productIds)
  const out = new Map<string, { before: number; since: number; failed: number; lastPaidAt: Date | null }>()
  for (const id of productIds) out.set(id, { before: 0, since: 0, failed: 0, lastPaidAt: null })
  const paidOrderKeys = new Set<string>()
  for (const o of orders) {
    if (!o.productId || !o.paidAt) continue
    if (o.stripeSessionId) paidOrderKeys.add(`${sessionBase(o.stripeSessionId)}|${o.productId}`)
    const f = out.get(o.productId)
    if (!f) continue
    const start = sinceOf.get(o.productId) ?? now
    const t = o.paidAt.getTime()
    if (t >= start.getTime()) f.since++
    else if (t >= start.getTime() - REFERENCE_DAYS * DAY) f.before++
  }
  for (const l of last) {
    const f = out.get(l.productId)
    if (f) f.lastPaidAt = l._max.paidAt ?? null
  }
  const traces: FailedLineTrace[] = []
  for (const r of failed) {
    const p = (r.payload ?? {}) as Record<string, unknown>
    if (typeof p.productId !== "string" || !set.has(p.productId)) continue
    traces.push({
      checkoutSessionId: typeof p.checkoutSessionId === "string" ? p.checkoutSessionId : null,
      productId: p.productId,
      reason: typeof p.reason === "string" ? p.reason : null,
      paymentIntentId: typeof p.paymentIntentId === "string" && p.paymentIntentId.trim() ? p.paymentIntentId : null,
      createdAt: r.createdAt,
    })
  }
  const q = qualifyFailedLines(traces, {
    paidOrderKeys,
    startOf: (pid) => sinceOf.get(pid) ?? new Date(now.getTime() - REFERENCE_DAYS * DAY),
  })
  for (const [pid, n] of q.byProduct) out.get(pid)!.failed = n
  return { facts: out, excluded: q.excluded }
}

function alertsFrom(snap: Snapshot, facts: Awaited<ReturnType<typeof demandFacts>>["facts"], sinceOf: Map<string, Date | null>, now: Date) {
  const alerts: BlockedDemandAlert[] = []
  for (const p of snap.products) {
    if (p.cause === null) continue
    const f = facts.get(p.row.id)
    if (!f) continue
    const a = qualifyBlockedDemand(
      {
        productId: p.row.id,
        productName: p.row.name,
        supplierId: p.row.supplierId,
        cause: p.cause,
        liveListings: p.listings,
        ordersBefore: f.before,
        ordersSince: f.since,
        lastPaidAt: f.lastPaidAt,
        failedPaidLines: f.failed,
        since: sinceOf.get(p.row.id) ?? null,
      },
      now
    )
    if (a) alerts.push(a)
  }
  return rankAlerts(alerts)
}

/** SUPPLIER view, READ-ONLY: its own products whose real demand is blocked today, with the start the monitor saw. */
export async function loadSupplierBlockedDemand(supplierId: string, now = new Date()): Promise<{ items: BlockedDemandAlert[]; truncated: boolean }> {
  const snap = await snapshot(supplierId)
  const unavailable = snap.products.filter((p) => p.cause !== null)
  const sinceOf = new Map<string, Date | null>()
  for (const p of unavailable) {
    const st = snap.states.get(episodeStateId(p.row.id))
    sinceOf.set(p.row.id, st?.open ? new Date(st.since) : null)
  }
  const { facts } = await demandFacts(unavailable.map((p) => p.row.id), sinceOf, now)
  return { items: alertsFrom(snap, facts, sinceOf, now), truncated: snap.truncated }
}

// ---------------------------------------------------------------------------------------------------------------
// Supplier preference
// ---------------------------------------------------------------------------------------------------------------

export async function loadSupplierAlertPreference(supplierId: string): Promise<SupplierAlertPreference> {
  const row = await prisma.auditLog.findUnique({ where: { id: supplierAlertPreferenceId(supplierId) }, select: { payload: true } })
  return row ? parseSupplierAlertPreference(row.payload) : DEFAULT_SUPPLIER_ALERT_PREFERENCE
}

export async function saveSupplierAlertPreference(supplierId: string, pref: SupplierAlertPreference): Promise<SupplierAlertPreference> {
  const clean = parseSupplierAlertPreference(pref)
  await prisma.auditLog.upsert({
    where: { id: supplierAlertPreferenceId(supplierId) },
    create: {
      id: supplierAlertPreferenceId(supplierId),
      action: SUPPLIER_ALERT_PREF_ACTION,
      entityType: "User",
      entityId: supplierId,
      actorId: supplierId,
      payload: clean,
    },
    update: { payload: clean },
  })
  return clean
}

// ---------------------------------------------------------------------------------------------------------------
// Daily run
// ---------------------------------------------------------------------------------------------------------------

export type SupplierBlockedDemandRun = {
  mode: "off" | "observe" | "enforce"
  listedProducts: number
  unavailable: number
  qualifying: number
  episodesOpened: number
  episodesResolved: number
  notified: number
  digests: number
  alreadyNotified: number
  skippedPreference: number
  deferredToTomorrow: number
  obsoleteDigestsCleared: number
  /** Preventive stock-out risks found (sellable today, cover below the lead time). */
  riskQualifying: number
  truncated: boolean
  observation?: BlockedDemandObservation | null
}

/**
 * Daily. Both modes keep the EPISODES (first observation / resolution — internal bookkeeping, needed to say « since
 * when »). `observe` then only measures; `enforce` sends at most ONE bell per supplier and per day, each product told
 * once per episode, gated by the supplier's preference, and clears digests that became obsolete. Never touches a
 * product, a stock, a listing or money.
 */
export async function runSupplierBlockedDemandAlerts(now = new Date()): Promise<SupplierBlockedDemandRun> {
  const mode = readSupplierBlockedDemandMode()
  const run: SupplierBlockedDemandRun = {
    mode,
    listedProducts: 0,
    unavailable: 0,
    qualifying: 0,
    episodesOpened: 0,
    episodesResolved: 0,
    notified: 0,
    digests: 0,
    alreadyNotified: 0,
    skippedPreference: 0,
    deferredToTomorrow: 0,
    obsoleteDigestsCleared: 0,
    riskQualifying: 0,
    truncated: false,
  }
  if (mode === "off") return run

  const snap = await snapshot(null)
  run.listedProducts = snap.products.length
  run.truncated = snap.truncated

  // Episodes of listed products (open / refresh / close).
  const sinceOf = new Map<string, Date | null>()
  for (const p of snap.products) {
    const id = episodeStateId(p.row.id)
    const step = nextEpisode(snap.states.get(id) ?? null, p.cause, now)
    if (step.opened) run.episodesOpened++
    if (step.resolved) run.episodesResolved++
    if (step.changed && step.state) {
      await prisma.auditLog.upsert({
        where: { id },
        create: { id, action: EPISODE_STATE_ACTION, entityType: "Product", entityId: p.row.id, actorId: null, payload: step.state },
        update: { payload: step.state },
      })
    }
    if (p.cause !== null && step.state?.open) sinceOf.set(p.row.id, new Date(step.state.since))
  }
  // Open episodes of products no longer listed anywhere: the shops do not show them any more — closed.
  const listedIds = new Set(snap.products.map((p) => p.row.id))
  if (!snap.truncated) {
    const open = await prisma.auditLog.findMany({
      where: { action: EPISODE_STATE_ACTION, payload: { path: ["open"], equals: true } },
      select: { id: true, entityId: true, payload: true },
      take: 10_000,
    })
    for (const o of open) {
      // `entityId` is nullable in the schema; an episode row is always written with its product id, so a null one is not ours to close.
      if (o.entityId === null || listedIds.has(o.entityId)) continue
      const st = parseEpisodeState(o.payload)
      if (!st) continue
      await prisma.auditLog.update({ where: { id: o.id }, data: { payload: { ...st, open: false, resolvedAt: now.toISOString() } } })
      run.episodesResolved++
    }
  }

  const unavailable = snap.products.filter((p) => p.cause !== null)
  run.unavailable = unavailable.length
  const { facts, excluded } = await demandFacts(unavailable.map((p) => p.row.id), sinceOf, now)
  const alerts = alertsFrom(snap, facts, sinceOf, now)
  run.qualifying = alerts.length

  // Preventive risks: products still sellable whose cover is below the lead time (blocked ones are told above).
  const unavailableIds = new Set(unavailable.map((p) => p.row.id))
  let risks: StockoutForecastItem[] = []
  try {
    risks = (await loadStockoutForecasts({ now })).items.filter((i) => isPreventiveAlert(i.forecast) && !unavailableIds.has(i.productId))
  } catch (error) {
    // A failed forecast read never blocks the blocked-demand alerts.
    console.error("[supplier-blocked-demand] forecast_unreadable", error instanceof Error ? error.message : "unknown")
  }
  run.riskQualifying = risks.length

  const notices: SupplierNotice[] = [
    ...alerts
      .filter((a) => a.since !== null)
      .map((a) => ({ supplierId: a.supplierId, productId: a.productId, productName: a.productName, kind: "blocked" as const, claimId: blockedDemandAlertId(a.productId, a.since!) })),
    ...risks.map((r) => ({
      supplierId: r.supplierId,
      productId: r.productId,
      productName: r.productName,
      kind: "risk" as const,
      claimId: stockoutRiskAlertId(r.productId, now),
      coverDays: r.forecast.calculation.coverDays,
    })),
  ]

  if (mode === "observe") {
    run.observation = await recordObservation(now, run, unavailable.map((p) => p.cause!), alerts, notices, excluded)
    console.log("[supplier-blocked-demand]", {
      result: "would_notify",
      qualifying: run.qualifying,
      risks: run.riskQualifying,
      wouldNotifyNew: run.observation?.wouldNotifyNew ?? null,
      wouldNotifySuppliersAll: run.observation?.wouldNotifySuppliersAll ?? null,
      truncated: run.truncated,
    })
    return run
  }
  await deliver(now, run, notices)
  await clearObsoleteDigests(run, new Set(notices.map((a) => a.productId)), now)
  return run
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002")
}

async function freshBy<T>(items: T[], idOf: (a: T) => string): Promise<T[]> {
  const ids = items.map(idOf)
  const existing = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    for (const r of await prisma.auditLog.findMany({ where: { id: { in: ids.slice(i, i + 500) } }, select: { id: true } })) existing.add(r.id)
  }
  return items.filter((a, k) => !existing.has(ids[k]!))
}

async function deliver(now: Date, run: SupplierBlockedDemandRun, notices: SupplierNotice[]) {
  const fresh = await freshBy(notices, (n) => n.claimId)
  run.alreadyNotified = notices.length - fresh.length
  for (const plan of planSupplierNotices(fresh)) {
    const pref = await loadSupplierAlertPreference(plan.supplierId)
    if (!pref.blockedDemandInApp) {
      run.skippedPreference += plan.items.length
      continue
    }
    try {
      await prisma.auditLog.create({
        data: {
          id: supplierDigestId(plan.supplierId, now),
          action: "supplier.blocked_demand_digest",
          entityType: "User",
          entityId: plan.supplierId,
          actorId: null,
          payload: { productIds: plan.items.map((a) => a.productId), notificationId: null },
        },
      })
    } catch (error) {
      // Already told today: nothing claimed — tomorrow's run re-evaluates them (a fixed product is then not sent).
      if (isUniqueViolation(error)) {
        run.deferredToTomorrow += plan.items.length
        continue
      }
      throw error
    }
    await prisma.auditLog.createMany({
      data: plan.items.map((a) => ({
        id: a.claimId,
        action: a.kind === "blocked" ? "supplier.blocked_demand_alerted" : "supplier.stockout_risk_alerted",
        entityType: "Product",
        entityId: a.productId,
        actorId: null,
        payload: { kind: a.kind },
      })),
      skipDuplicates: true,
    })
    const locale = isAppLocale(pref.locale) ? pref.locale : "fr"
    const t = createTranslator({ locale, messages: loadAppMessages(locale), namespace: "catalogHealth.blockedDemand" }) as unknown as (
      key: string,
      values?: Record<string, string | number>
    ) => string
    const first = plan.items[0]!
    const message =
      plan.kind === "single_blocked"
        ? t("bellSingle", { product: first.productName.slice(0, 120) })
        : plan.kind === "single_risk"
          ? t("riskSingle", { product: first.productName.slice(0, 120), days: Math.max(0, Math.round(first.coverDays ?? 0)) })
          : plan.allBlocked
            ? t("bellDigest", { count: plan.items.length })
            : t("attentionDigest", { count: plan.items.length })
    const notif = await prisma.notification.create({ data: { userId: plan.supplierId, type: SUPPLIER_BLOCKED_DEMAND_NOTIF, message } })
    await prisma.auditLog.update({
      where: { id: supplierDigestId(plan.supplierId, now) },
      data: { payload: { productIds: plan.items.map((a) => a.productId), notificationId: notif.id } },
    })
    run.notified++
    if (plan.kind === "digest") run.digests++
  }
}

/** A bell still unread whose products are ALL available again is marked read: it would be a false alarm. */
async function clearObsoleteDigests(run: SupplierBlockedDemandRun, stillBlocked: Set<string>, now: Date) {
  const recent = await prisma.auditLog.findMany({
    where: { action: "supplier.blocked_demand_digest", createdAt: { gte: new Date(now.getTime() - 14 * DAY) } },
    select: { payload: true },
    take: 5_000,
  })
  for (const r of recent) {
    const p = (r.payload ?? {}) as { productIds?: unknown; notificationId?: unknown }
    const ids = Array.isArray(p.productIds) ? p.productIds.filter((x): x is string => typeof x === "string") : []
    if (typeof p.notificationId !== "string" || !digestIsObsolete(ids, stillBlocked)) continue
    const res = await prisma.notification.updateMany({ where: { id: p.notificationId, read: false }, data: { read: true } })
    run.obsoleteDigestsCleared += res.count
  }
}

async function recordObservation(
  now: Date,
  run: SupplierBlockedDemandRun,
  causes: UnavailabilityCause[],
  alerts: BlockedDemandAlert[],
  notices: SupplierNotice[],
  failedLinesExcluded: Record<string, number>
): Promise<BlockedDemandObservation | null> {
  try {
    // Observed markers have their OWN ids: observing never uses up a real alert.
    const observedIdOf = (n: SupplierNotice) =>
      n.kind === "blocked" ? n.claimId.replace("supplier-blocked-demand-alert:", "supplier-blocked-demand-observed:") : stockoutRiskObservedId(n.productId, now)
    const fresh = await freshBy(notices, observedIdOf)
    if (fresh.length) {
      await prisma.auditLog.createMany({
        data: fresh.map((n) => ({
          id: observedIdOf(n),
          action: BLOCKED_DEMAND_OBSERVED_ACTION,
          entityType: "Product",
          entityId: n.productId,
          actorId: null,
          payload: { kind: n.kind },
        })),
        skipDuplicates: true,
      })
    }
    const prefOff = new Set<string>()
    for (const s of new Set(fresh.map((a) => a.supplierId))) {
      if (!(await loadSupplierAlertPreference(s)).blockedDemandInApp) prefOff.add(s)
    }
    const freshBlockedIds = new Set(fresh.filter((n) => n.kind === "blocked").map((n) => n.productId))
    const observation: BlockedDemandObservation = {
      ...summarizeBlockedDemand({
        now,
        listedProducts: run.listedProducts,
        causes,
        qualifying: alerts,
        newAlerts: alerts.filter((a) => freshBlockedIds.has(a.productId)),
        prefOff,
        episodesOpened: run.episodesOpened,
        episodesResolved: run.episodesResolved,
        truncated: run.truncated,
      }),
      failedLinesExcluded,
      riskQualifying: run.riskQualifying,
      wouldNotifyRiskNew: fresh.filter((n) => n.kind === "risk" && !prefOff.has(n.supplierId)).length,
      wouldNotifySuppliersAll: new Set(fresh.filter((n) => !prefOff.has(n.supplierId)).map((n) => n.supplierId)).size,
    }
    await prisma.auditLog.createMany({
      data: [
        {
          id: blockedDemandObservationId(now),
          action: BLOCKED_DEMAND_OBSERVATION_ACTION,
          entityType: "SupplierBlockedDemandObservation",
          entityId: observation.day,
          actorId: null,
          payload: observation,
        },
      ],
      skipDuplicates: true,
    })
    return observation
  } catch (error) {
    console.error("[supplier-blocked-demand] observation_failed", { error: error instanceof Error ? error.message : "unknown" })
    return null
  }
}

/** ADMIN, READ-ONLY: the daily measurements. */
export async function loadBlockedDemandObservations(days = 30): Promise<BlockedDemandObservation[]> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 180) * DAY)
  const rows = await prisma.auditLog.findMany({
    where: { action: BLOCKED_DEMAND_OBSERVATION_ACTION, createdAt: { gte: since } },
    select: { payload: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return rows.map((r) => r.payload as unknown as BlockedDemandObservation)
}
