import "server-only"

import type { Prisma } from "@prisma/client"

import { createTranslator } from "next-intl"

import { isAppLocale } from "@/lib/i18n-locale"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { listingProblem } from "@/lib/reseller-replacement/listing-state"
import {
  decideRestockWatch,
  locateWatchedVariant,
  parseRestockWatch,
  readRestockWatchMode,
  RESTOCK_WATCH_ACTION,
  RESTOCK_WATCH_MAX_ACTIVE,
  RESTOCK_WATCH_OBSERVATION_ACTION,
  RESTOCK_WATCH_OBSERVED_ACTION,
  restockWatchObservedId,
  summarizeRestockObservations,
  type RestockObservationReport,
  RESTOCK_WATCH_SENT_ACTION,
  restockWatchId,
  restockWatchObservationId,
  restockWatchSentId,
  variantWatchKey,
  type RestockWatch,
  type RestockWatchMode,
  type RestockWatchObservation,
} from "@/lib/restock-watch/restock-watch"
import { resolveVariantChoice, rowsForChoice, variantRowDimensions, type VariantChoice } from "@/lib/variant-selection"
import { sendRestockPushToUser } from "@/lib/web-push-send"

const MAX_WATCHES_PER_RUN = 2_000

const listingSelect = {
  id: true,
  isListed: true,
  productId: true,
  customTitle: true,
  product: {
    select: {
      id: true,
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
      customColumns: true,
      productVariants: { select: { color: true, size: true, stock: true, customData: true }, take: 200 },
    },
  },
} as const

type WatchListing = NonNullable<Awaited<ReturnType<typeof loadListing>>>

async function loadListing(listingId: string) {
  return prisma.affiliateProduct.findUnique({ where: { id: listingId }, select: listingSelect })
}

function rowsOf(l: WatchListing) {
  return rowsForChoice(l.product.variants, l.product.productVariants, l.product.customColumns)
}

/** The row the buyer's choice names, with its exact key — or why there is none. Same rule as checkout. */
function resolveWatchedRow(l: WatchListing, choice: VariantChoice) {
  const rows = rowsOf(l)
  const r = resolveVariantChoice(rows, choice, l.product.customColumns)
  if (r.kind !== "resolved") return { ok: false as const, error: r.kind === "incomplete" ? ("variant_incomplete" as const) : ("variant_unknown" as const) }
  const dims = variantRowDimensions(rows, l.product.customColumns)[r.index]!
  const located = locateWatchedVariant(rows, l.product.customColumns, variantWatchKey(dims))
  if (located.status !== "found") return { ok: false as const, error: "variant_unknown" as const }
  const name = ((rows as { variantRows?: Array<{ name?: string }> }).variantRows?.[r.index]?.name ?? "").trim()
  const storage = choice.storage?.trim() || ""
  const label = storage && !name.toLowerCase().includes(storage.toLowerCase()) ? `${name} · ${storage}` : name
  return { ok: true as const, key: variantWatchKey(dims), label: label.replace(/^\s*\/\s*/, "") || "—", stock: located.stock }
}

async function activeCount(userId: string): Promise<number> {
  return prisma.auditLog.count({
    where: { action: RESTOCK_WATCH_ACTION, id: { startsWith: `restock-watch:${userId}:` }, payload: { path: ["state"], equals: "active" } },
  })
}

export type CreateRestockWatchResult =
  | { ok: true; watchId: string; already: boolean }
  | { ok: false; error: "mode_off" | "listing_not_found" | "variant_unknown" | "variant_incomplete" | "available_now" | "too_many" }

/**
 * An explicit request of a signed-in buyer for ONE sold-out variant. Idempotent (same buyer × listing × variant = the
 * same request); a request already answered (or cancelled / expired) is re-opened as a new episode. Refused when the
 * variant is available right now (nothing to wait for) or can not be told exactly — never a guessed variant.
 */
export async function createRestockWatch(args: {
  userId: string
  listingId: string
  choice: VariantChoice
  locale: string
  now?: Date
}): Promise<CreateRestockWatchResult> {
  const now = args.now ?? new Date()
  if (readRestockWatchMode() === "off") return { ok: false, error: "mode_off" }
  const visible = await prisma.affiliateProduct.findFirst({ where: { id: args.listingId, ...buyerListedAffiliateProductWhere }, select: { id: true } })
  const listing = visible ? await loadListing(args.listingId) : null
  if (!listing) return { ok: false, error: "listing_not_found" }
  const row = resolveWatchedRow(listing, args.choice)
  if (!row.ok) return { ok: false, error: row.error }
  if (row.stock > 0 && listingProblem(listing.product) === null) return { ok: false, error: "available_now" }
  const id = restockWatchId(args.userId, listing.id, row.key)
  const existing = parseRestockWatch((await prisma.auditLog.findUnique({ where: { id }, select: { payload: true } }))?.payload)
  if (existing?.state === "active") return { ok: true, watchId: id, already: true }
  if ((await activeCount(args.userId)) >= RESTOCK_WATCH_MAX_ACTIVE) return { ok: false, error: "too_many" }
  const watch: RestockWatch = {
    userId: args.userId,
    listingId: listing.id,
    productId: listing.productId,
    variantKey: row.key,
    variantLabel: row.label.slice(0, 120),
    locale: isAppLocale(args.locale) ? args.locale : "fr",
    state: "active",
    episode: existing ? existing.episode + 1 : 1,
    requestedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    closedReason: null,
    notifiedAt: null,
  }
  if (existing) {
    await prisma.auditLog.update({ where: { id }, data: { payload: watch as unknown as Prisma.InputJsonValue } })
  } else {
    await prisma.auditLog.createMany({
      data: [{ id, action: RESTOCK_WATCH_ACTION, entityType: "AffiliateProduct", entityId: listing.id, actorId: args.userId, payload: watch as unknown as Prisma.InputJsonValue }],
      skipDuplicates: true,
    })
  }
  return { ok: true, watchId: id, already: false }
}

/** The buyer's own request only; a request that is not theirs is « not found ». */
export async function cancelRestockWatch(userId: string, watchId: string, now = new Date()): Promise<boolean> {
  if (!watchId.startsWith(`restock-watch:${userId}:`)) return false
  const row = await prisma.auditLog.findUnique({ where: { id: watchId }, select: { payload: true } })
  const w = parseRestockWatch(row?.payload)
  if (!w || w.userId !== userId) return false
  if (w.state !== "active") return true
  await prisma.auditLog.update({
    where: { id: watchId },
    data: { payload: { ...w, state: "cancelled", closedReason: "cancelled_by_buyer", updatedAt: now.toISOString() } as unknown as Prisma.InputJsonValue },
  })
  return true
}

/** Is THIS choice watched by THIS buyer? (the page shows « Vous serez prévenu » / « Me prévenir »). */
export async function restockWatchStatus(userId: string | null, listingId: string, choice: VariantChoice) {
  const mode = readRestockWatchMode()
  if (mode === "off") return { mode, watching: false as const, watchId: null }
  const listing = await loadListing(listingId)
  if (!listing) return { mode, watching: false as const, watchId: null }
  const row = resolveWatchedRow(listing, choice)
  if (!row.ok || !userId) return { mode, watching: false as const, watchId: null }
  const id = restockWatchId(userId, listing.id, row.key)
  const w = parseRestockWatch((await prisma.auditLog.findUnique({ where: { id }, select: { payload: true } }))?.payload)
  return { mode, watching: w?.state === "active", watchId: w?.state === "active" ? id : null }
}

/** The buyer's own requests (their account page / the product page), newest first. */
export async function listRestockWatches(userId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { action: RESTOCK_WATCH_ACTION, id: { startsWith: `restock-watch:${userId}:` } },
    select: { id: true, payload: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return rows
    .map((r) => ({ id: r.id, watch: parseRestockWatch(r.payload) }))
    .filter((r): r is { id: string; watch: RestockWatch } => r.watch !== null && r.watch.userId === userId)
    .map(({ id, watch }) => ({ id, listingId: watch.listingId, variantLabel: watch.variantLabel, state: watch.state, requestedAt: watch.requestedAt }))
}

export type RestockWatchRun = RestockWatchObservation & {
  truncated: boolean
  /** Demand episodes (see `restock-funnel.ts`): bookkeeping of this run, never a product or a stock. */
  episodes?: { opened: number; returned: number; closed: number; updated: number } | { error: true }
}

/**
 * Periodic. `observe`: measures what it WOULD send and closes requests that became useless (variant removed, listing
 * deleted, older than the TTL) — sends nothing. `enforce`: for each request whose variant is REALLY back, re-reads the
 * listing right before sending (a stock that went back to 0 in between sends nothing), claims the episode's send id
 * (once, whatever runs concurrently), then sends ONE Web Push and closes the request. A buyer with no push subscription
 * left (permission withdrawn, subscription removed) gets nothing and the request stays waiting until it expires.
 */
export async function runRestockWatchNotify(now = new Date()): Promise<RestockWatchRun> {
  const mode = readRestockWatchMode()
  const run: RestockWatchRun = {
    day: now.toISOString().slice(0, 10),
    mode,
    active: 0,
    activeBuyers: 0,
    activeVariants: 0,
    wouldNotify: 0,
    wouldNotifyNew: 0,
    notified: 0,
    noChannel: 0,
    raced: 0,
    closed: {},
    kept: {},
    truncated: false,
  }
  if (mode === "off") return run
  const rows = await prisma.auditLog.findMany({
    where: { action: RESTOCK_WATCH_ACTION, payload: { path: ["state"], equals: "active" } },
    select: { id: true, payload: true },
    orderBy: { createdAt: "asc" },
    take: MAX_WATCHES_PER_RUN + 1,
  })
  run.truncated = rows.length > MAX_WATCHES_PER_RUN
  const watches = rows
    .slice(0, MAX_WATCHES_PER_RUN)
    .map((r) => ({ id: r.id, watch: parseRestockWatch(r.payload) }))
    .filter((r): r is { id: string; watch: RestockWatch } => r.watch !== null)
  run.active = watches.length
  run.activeBuyers = new Set(watches.map((w) => w.watch.userId)).size
  run.activeVariants = new Set(watches.map((w) => `${w.watch.listingId}\u0000${w.watch.variantKey}`)).size
  if (watches.length === 0) {
    await trackEpisodes(run, now)
    return run
  }

  const listingIds = [...new Set(watches.map((w) => w.watch.listingId))]
  const listings = new Map((await prisma.affiliateProduct.findMany({ where: { id: { in: listingIds } }, select: listingSelect })).map((l) => [l.id, l]))
  const visible = new Set(
    (await prisma.affiliateProduct.findMany({ where: { id: { in: listingIds }, ...buyerListedAffiliateProductWhere }, select: { id: true } })).map((l) => l.id)
  )
  const judge = (w: RestockWatch, l: WatchListing | undefined, isVisible: boolean) =>
    decideRestockWatch({
      watch: w,
      now,
      listing: l ? { exists: true, listed: l.isListed && isVisible, sellable: listingProblem(l.product) === null } : null,
      variant: l ? locateWatchedVariant(rowsOf(l), l.product.customColumns, w.variantKey) : null,
    })

  for (const { id, watch } of watches) {
    const decision = judge(watch, listings.get(watch.listingId), visible.has(watch.listingId))
    if (decision.action === "close") {
      run.closed[decision.reason] = (run.closed[decision.reason] ?? 0) + 1
      await prisma.auditLog.update({
        where: { id },
        data: { payload: { ...watch, state: decision.reason === "expired" ? "expired" : "closed", closedReason: decision.reason, updatedAt: now.toISOString() } as unknown as Prisma.InputJsonValue },
      })
      continue
    }
    if (decision.action === "keep") {
      run.kept[decision.reason] = (run.kept[decision.reason] ?? 0) + 1
      continue
    }
    if (decision.action !== "notify") continue
    run.wouldNotify++
    if (mode !== "enforce") {
      try {
        const marked = await prisma.auditLog.createMany({
          data: [
            {
              id: restockWatchObservedId(id, watch.episode),
              action: RESTOCK_WATCH_OBSERVED_ACTION,
              entityType: "AffiliateProduct",
              entityId: watch.listingId,
              actorId: null,
              payload: { episode: watch.episode },
            },
          ],
          skipDuplicates: true,
        })
        run.wouldNotifyNew += marked.count
      } catch (error) {
        console.error("[restock-watch] observed_marker_failed", error instanceof Error ? error.message : "unknown")
      }
      continue
    }
    if ((await prisma.pushSubscription.count({ where: { userId: watch.userId } })) === 0) {
      run.noChannel++
      continue
    }
    // Fresh read right before sending: a variant that sold out again meanwhile is never announced.
    const fresh = await loadListing(watch.listingId)
    const freshVisible = fresh ? Boolean(await prisma.affiliateProduct.findFirst({ where: { id: fresh.id, ...buyerListedAffiliateProductWhere }, select: { id: true } })) : false
    if (judge(watch, fresh ?? undefined, freshVisible).action !== "notify" || !fresh) {
      run.raced++
      continue
    }
    const claimed = await prisma.auditLog.createMany({
      data: [
        {
          id: restockWatchSentId(id, watch.episode),
          action: RESTOCK_WATCH_SENT_ACTION,
          entityType: "AffiliateProduct",
          entityId: watch.listingId,
          actorId: null,
          payload: { episode: watch.episode },
        },
      ],
      skipDuplicates: true,
    })
    if (claimed.count === 1) {
      run.wouldNotifyNew++
      const locale = isAppLocale(watch.locale) ? watch.locale : "fr"
      const t = createTranslator({ locale, messages: loadAppMessages(locale), namespace: "restockWatch", timeZone: "Europe/Paris" }) as unknown as (
        key: string,
        values?: Record<string, string>
      ) => string
      const name = (fresh.customTitle?.trim() || fresh.product.name).slice(0, 80)
      await sendRestockPushToUser({
        userId: watch.userId,
        title: t("pushTitle", { product: name }),
        body: t("pushBody", { variant: watch.variantLabel }),
        url: `/marketplace/${encodeURIComponent(watch.listingId)}`,
        tag: `affisell-restock-${watch.listingId}`,
      })
      run.notified++
    }
    await prisma.auditLog.update({
      where: { id },
      data: { payload: { ...watch, state: "notified", notifiedAt: now.toISOString(), updatedAt: now.toISOString() } as unknown as Prisma.InputJsonValue },
    })
  }

  await trackEpisodes(run, now)
  try {
    await prisma.auditLog.createMany({
      data: [
        {
          id: restockWatchObservationId(now),
          action: RESTOCK_WATCH_OBSERVATION_ACTION,
          entityType: "RestockWatchObservation",
          entityId: run.day,
          actorId: null,
          payload: run as unknown as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    })
  } catch (error) {
    console.error("[restock-watch] observation_failed", error instanceof Error ? error.message : "unknown")
  }
  console.log("[restock-watch]", { mode, active: run.active, wouldNotify: run.wouldNotify, notified: run.notified, noChannel: run.noChannel, raced: run.raced })
  return run
}

export type { RestockWatchMode }

/** ADMIN read: daily snapshots + theoretical (observed markers) and real (send claims) counts, apart. Counts only. */
export async function loadRestockWatchObservations(
  days = 30,
  now = new Date()
): Promise<RestockObservationReport & { mode: RestockWatchMode; funnel: import("@/lib/restock-watch/restock-funnel").DemandFunnelSummary | null
  resellerRecovery: import("@/lib/restock-watch/shop-demand").ShopRecoverySummary | null
}> {
  const span = Math.min(Math.max(1, Math.round(days)), 90)
  const since = new Date(now.getTime() - span * 86_400_000)
  const dayOf = (d: Date) => d.toISOString().slice(0, 10)
  const [snapshots, observed, sent] = await Promise.all([
    prisma.auditLog.findMany({ where: { action: RESTOCK_WATCH_OBSERVATION_ACTION, createdAt: { gte: since } }, select: { entityId: true, payload: true }, take: 200 }),
    prisma.auditLog.findMany({ where: { action: RESTOCK_WATCH_OBSERVED_ACTION, createdAt: { gte: since } }, select: { createdAt: true }, take: 50_000 }),
    prisma.auditLog.findMany({ where: { action: RESTOCK_WATCH_SENT_ACTION, createdAt: { gte: since } }, select: { createdAt: true }, take: 50_000 }),
  ])
  const { loadDemandEpisodes } = await import("@/lib/restock-watch/restock-funnel.server")
  const funnel = await loadDemandEpisodes({ supplierId: null, days: span, now })
    .then((r) => r.summary)
    .catch(() => null)
  const { loadShopRecovery } = await import("@/lib/restock-watch/shop-demand.server")
  const resellerRecovery = await loadShopRecovery({ affiliateId: null, days: span, now }).catch(() => null)
  return {
    mode: readRestockWatchMode(),
    funnel,
    resellerRecovery,
    ...summarizeRestockObservations({
      snapshots: snapshots.map((s) => ({ day: s.entityId ?? "", payload: s.payload })).filter((s) => s.day),
      observedMarkerDays: observed.map((o) => dayOf(o.createdAt)),
      sentClaimDays: sent.map((o) => dayOf(o.createdAt)),
    }),
  }
}

async function trackEpisodes(run: RestockWatchRun, now: Date): Promise<void> {
  try {
    const { trackRestockDemandEpisodes } = await import("@/lib/restock-watch/restock-funnel.server")
    run.episodes = await trackRestockDemandEpisodes(now)
  } catch (error) {
    run.episodes = { error: true }
    console.error("[restock-demand] episodes_failed", error instanceof Error ? error.message : "unknown")
  }
}
