import { Prisma } from "@prisma/client"

import {
  EXPECTED_TRIGGERS,
  PRESENCE_MIGRATION_NAME,
  PRESENCE_TABLE,
  READINESS_MAX_EVENTS,
  buildPresenceReadinessReport,
  type CatalogFacts,
  type EngineLine,
  type IntegrityFacts,
  type PresenceReadinessReport,
  type StaticFacts,
  type VolumeFacts,
} from "../listing-presence/integrity"
import { rebuildPresence, type PresenceEvent, type PresenceKind } from "../listing-presence/periods"
import {
  AUDIT_WITNESS_SOURCES,
  CLOCK_MARGIN_NON_UTC_MS,
  reconcileMutations,
  type ReconciliationReport,
} from "../listing-presence/reconciliation"
import { isOrderClosedForPayout } from "../orders/payment-state"
import { buildActivationReadiness } from "../reseller-copilot/activation-readiness"
import { measurePeriods, type MeasuredPeriod } from "../reseller-copilot/temporal-opportunities"
import { RETENTION_ACTION } from "../reseller-copilot/retention-advisor"
import { PLAN_ACTION } from "../reseller-copilot/observation-plan"
import { CH_SNAPSHOT_ACTION } from "../reseller-copilot/contextual-horizon"

/**
 * Collector of `report:presence-readiness` — reads ONLY (the caller passes a read-only transaction; PostgreSQL refuses
 * any write in it). Every catalog read that could raise an error inside the transaction (which would abort it) is
 * guarded first (`to_regclass`, server version, privilege checks). Aggregates only: no listing, reseller, product or
 * order identifier leaves this function. Kept apart from the script so it runs on a real PostgreSQL in CI.
 */
const DAY = 86_400_000
const KINDS: readonly PresenceKind[] = ["created", "listed", "unlisted", "deleted"]
const T = `"${PRESENCE_TABLE}"`

type Tx = Prisma.TransactionClient
// Tagged `$queryRaw` only (parameters bound by Prisma): the read-only client refuses `$queryRawUnsafe` and every write.
const one = async <R>(tx: Tx, sql: Prisma.Sql): Promise<R | undefined> => ((await tx.$queryRaw(sql)) as R[])[0]
const rows = async <R>(tx: Tx, sql: Prisma.Sql): Promise<R[]> => (await tx.$queryRaw(sql)) as R[]
const TABLE = Prisma.raw(T)
const n = (x: unknown) => Number(x ?? 0)

export async function collectCatalogFacts(tx: Tx): Promise<CatalogFacts> {
  const reg = await one<{ m: boolean; t: boolean; s: boolean; v: number }>(tx, Prisma.sql`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS m,
            to_regclass('public."ListingPresenceEvent"') IS NOT NULL AS t,
            has_table_privilege('pg_catalog.pg_db_role_setting', 'SELECT') AS s,
            current_setting('server_version_num')::int AS v`)
  let migrationRow: CatalogFacts["migrationRow"] = "unreadable"
  let migrationFinishedAt: Date | null = null
  if (reg?.m) {
    const r = await one<{ f: Date | null; rb: Date | null }>(tx, Prisma.sql`SELECT finished_at AS f, rolled_back_at AS rb FROM "_prisma_migrations" WHERE migration_name = ${PRESENCE_MIGRATION_NAME} ORDER BY started_at DESC LIMIT 1`)
    migrationRow = !r ? "absent" : r.rb ? "rolled_back" : r.f ? "applied" : "failed"
    migrationFinishedAt = migrationRow === "applied" ? (r?.f ?? null) : null
  }
  const tableExists = Boolean(reg?.t)
  const columns = tableExists
    ? (await rows<{ c: string }>(tx, Prisma.sql`SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${PRESENCE_TABLE}`)).map((r) => r.c)
    : []
  const constraints = tableExists
    ? (await rows<{ c: string }>(tx, Prisma.sql`SELECT conname AS c FROM pg_constraint WHERE conrelid = 'public."ListingPresenceEvent"'::regclass`)).map((r) => r.c)
    : []
  const indexes = tableExists
    ? (await rows<{ c: string }>(tx, Prisma.sql`SELECT indexname AS c FROM pg_indexes WHERE schemaname = 'public' AND tablename = ${PRESENCE_TABLE}`)).map((r) => r.c)
    : []
  const triggerNames = EXPECTED_TRIGGERS.map((t) => t.name)
  const triggers = (
    await rows<{ name: string; tbl: string; en: string; def: string; body: string | null }>(
      tx,
      Prisma.sql`SELECT t.tgname AS name, c.relname AS tbl, t.tgenabled::text AS en, pg_get_triggerdef(t.oid) AS def, p.prosrc AS body
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace ns ON ns.oid = c.relnamespace
         LEFT JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE NOT t.tgisinternal AND ns.nspname = 'public' AND t.tgname = ANY(${triggerNames}::text[])`,
    )
  ).map((r) => ({ name: r.name, table: r.tbl, enabled: r.en, definition: r.def, functionBody: r.body }))
  const role = await one<{ srr: string; su: boolean | null }>(tx, Prisma.sql`SELECT current_setting('session_replication_role') AS srr, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su`)
  let replicaDefaults: number | null = null
  if (reg?.s) {
    const r = await one<{ k: number }>(tx, Prisma.sql`SELECT count(*)::int AS k FROM pg_db_role_setting WHERE array_to_string(setconfig, ',') ILIKE '%session_replication_role=replica%'`)
    replicaDefaults = n(r?.k)
  }
  let roleMaySetReplicationRole: boolean | null = null
  if ((reg?.v ?? 0) >= 150000) {
    const r = await one<{ p: boolean }>(tx, Prisma.sql`SELECT has_parameter_privilege('session_replication_role', 'SET') AS p`)
    roleMaySetReplicationRole = r?.p ?? null
  }
  let roleOwnsTable: boolean | null = null
  let roleHasTruncate: boolean | null = null
  if (tableExists) {
    const r = await one<{ own: boolean; tr: boolean }>(tx, Prisma.sql`SELECT pg_get_userbyid(relowner) = current_user AS own, has_table_privilege('public."ListingPresenceEvent"', 'TRUNCATE') AS tr FROM pg_class WHERE oid = 'public."ListingPresenceEvent"'::regclass`)
    roleOwnsTable = r?.own ?? null
    roleHasTruncate = r?.tr ?? null
  }
  return {
    migrationRow,
    migrationFinishedAt,
    tableExists,
    columns,
    constraints,
    indexes,
    triggers,
    sessionReplicationRole: role?.srr ?? null,
    replicaDefaults,
    roleMaySetReplicationRole,
    roleIsSuperuser: role?.su ?? null,
    roleOwnsTable,
    roleHasTruncate,
  }
}

export async function collectIntegrityFacts(tx: Tx, trackingStart: Date | null): Promise<IntegrityFacts> {
  const base = await one<{ events: number; future: number; before: number | null; newest: Date | null }>(tx, Prisma.sql`SELECT count(*)::int AS events, max("effectiveAt") AS newest,
            count(*) FILTER (WHERE "effectiveAt" > (clock_timestamp() AT TIME ZONE 'UTC') + interval '5 minutes')::int AS future,
            CASE WHEN (${trackingStart?.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC') IS NULL THEN NULL ELSE count(*) FILTER (WHERE "effectiveAt" < (${trackingStart?.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC'))::int END AS before
       FROM ${TABLE}`)
  const byKind = Object.fromEntries((await rows<{ k: string; c: number }>(tx, Prisma.sql`SELECT kind AS k, count(*)::int AS c FROM ${TABLE} GROUP BY kind`)).map((r) => [r.k, n(r.c)]))
  const bySource = Object.fromEntries((await rows<{ k: string; c: number }>(tx, Prisma.sql`SELECT source AS k, count(*)::int AS c FROM ${TABLE} GROUP BY source`)).map((r) => [r.k, n(r.c)]))
  const seq = await one<Record<string, number>>(tx, Prisma.sql`WITH e AS (
       SELECT kind, "previousListed" AS p, "effectiveAt" AS t,
              lag(kind) OVER w AS pk, lag("newListed") OVER w AS pn, lag("effectiveAt") OVER w AS pt, row_number() OVER w AS rn
         FROM ${TABLE} WINDOW w AS (PARTITION BY "affiliateProductId" ORDER BY id))
     SELECT count(*) FILTER (WHERE rn > 1 AND kind <> 'created' AND pk <> 'deleted' AND p IS DISTINCT FROM pn)::int AS chain,
            count(*) FILTER (WHERE rn > 1 AND kind = 'created')::int AS created_not_first,
            count(*) FILTER (WHERE rn > 1 AND pk = 'deleted')::int AS after_deleted,
            count(*) FILTER (WHERE rn > 1 AND t < pt)::int AS inversions,
            count(*) FILTER (WHERE kind = 'listed' AND pk = 'unlisted')::int AS relistings
       FROM e`)
  const dup = await one<{ d: number }>(tx, Prisma.sql`SELECT coalesce(sum(c - 1), 0)::int AS d FROM (
       SELECT count(*) AS c FROM ${TABLE} GROUP BY "affiliateProductId", kind, "previousListed", "newListed", "effectiveAt" HAVING count(*) > 1) x`)
  const last = await one<Record<string, number>>(tx, Prisma.sql`WITH last AS (
       SELECT DISTINCT ON ("affiliateProductId") "affiliateProductId" AS a, kind, "newListed" AS nl
         FROM ${TABLE} ORDER BY "affiliateProductId", id DESC)
     SELECT count(*) FILTER (WHERE ap.id IS NULL AND last.kind <> 'deleted')::int AS orphans,
            count(*) FILTER (WHERE ap.id IS NOT NULL AND last.kind = 'deleted')::int AS deleted_present,
            count(*) FILTER (WHERE ap.id IS NOT NULL AND last.kind <> 'deleted' AND last.nl IS DISTINCT FROM ap."isListed")::int AS mismatch
       FROM last LEFT JOIN "AffiliateProduct" ap ON ap.id = last.a`)
  const attr = await one<{ k: number }>(tx, Prisma.sql`SELECT count(*)::int AS k FROM ${TABLE} e JOIN "AffiliateProduct" ap ON ap.id = e."affiliateProductId"
      WHERE e."affiliateId" <> ap."affiliateId" OR e."productId" <> ap."productId"`)
  const conc = await one<{ top: number; n: number }>(tx, Prisma.sql`SELECT coalesce(max(c), 0)::int AS top, count(*)::int AS n FROM (SELECT count(*) AS c FROM ${TABLE} GROUP BY "affiliateId") x`)
  const reintro = await one<{ k: number }>(tx, Prisma.sql`SELECT count(*)::int AS k FROM (SELECT 1 FROM ${TABLE} GROUP BY "affiliateId", "productId" HAVING count(DISTINCT "affiliateProductId") > 1) x`)
  // Capture Sentinel residue: a probe always rolls back, so a SURVIVING sentinel listing is a defect to clean.
  const sentinel = await one<{ l: number }>(tx, Prisma.sql`SELECT count(*)::int AS l FROM "AffiliateProduct" WHERE id LIKE 'capture-sentinel-%'`)
  let createdWithoutEvent: number | null = null
  let preExistingListings: number | null = null
  if (trackingStart) {
    const r = await one<{ w: number; pre: number }>(tx, Prisma.sql`SELECT count(*) FILTER (WHERE ap."createdAt" >= (${trackingStart?.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC') AND NOT EXISTS (
                SELECT 1 FROM ${TABLE} e WHERE e."affiliateProductId" = ap.id AND e.kind = 'created'))::int AS w,
              count(*) FILTER (WHERE ap."createdAt" < (${trackingStart?.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC'))::int AS pre
         FROM "AffiliateProduct" ap`)
    createdWithoutEvent = n(r?.w)
    preExistingListings = n(r?.pre)
  }
  const events = n(base?.events)
  return {
    events,
    truncated: events > READINESS_MAX_EVENTS,
    byKind,
    bySource,
    futureEvents: n(base?.future),
    beforeTrackingStart: base?.before === null || base?.before === undefined ? null : n(base.before),
    chainBreaks: n(seq?.chain),
    createdNotFirst: n(seq?.created_not_first),
    afterDeleted: n(seq?.after_deleted),
    orderInversions: n(seq?.inversions),
    duplicates: n(dup?.d),
    orphanListings: n(last?.orphans),
    deletedButPresent: n(last?.deleted_present),
    stateMismatches: n(last?.mismatch),
    createdWithoutEvent,
    attributionMismatches: n(attr?.k),
    preExistingListings,
    reintroducedPairs: n(reintro?.k),
    relistings: n(seq?.relistings),
    newestEventAt: base?.newest ?? null,
    topResellerEventShare: events > 0 ? Math.round((n(conc?.top) / events) * 1000) / 1000 : null,
    resellersWithEvents: n(conc?.n),
    sentinelResidueListings: n(sentinel?.l),
  }
}

/** Volumes through the engines' OWN period rebuild (rebuildPresence + measurePeriods) and their readiness. */
export async function collectVolumes(tx: Tx, trackingStart: Date, now: Date): Promise<{ volumes: VolumeFacts; engines: EngineLine[] } | null> {
  const evs = await tx.listingPresenceEvent.findMany({
    orderBy: { id: "asc" },
    take: READINESS_MAX_EVENTS + 1,
    select: { affiliateProductId: true, affiliateId: true, productId: true, kind: true, previousListed: true, newListed: true, source: true, effectiveAt: true },
  })
  if (evs.length > READINESS_MAX_EVENTS) return null
  const byListing = new Map<string, { affiliateId: string; productId: string; events: PresenceEvent[] }>()
  for (const e of evs) {
    if (!KINDS.includes(e.kind as PresenceKind)) continue
    const cur = byListing.get(e.affiliateProductId) ?? { affiliateId: e.affiliateId, productId: e.productId, events: [] }
    cur.events.push({ kind: e.kind as PresenceKind, previousListed: e.previousListed, newListed: e.newListed, effectiveAt: e.effectiveAt, source: e.source })
    byListing.set(e.affiliateProductId, cur)
  }
  const current = await tx.affiliateProduct.findMany({ where: { id: { in: [...byListing.keys()] } }, select: { id: true, isListed: true, createdAt: true } })
  const currentBy = new Map(current.map((c) => [c.id, c]))
  const productIds = [...new Set([...byListing.values()].map((l) => l.productId))]
  const orders = productIds.length
    ? await tx.order.findMany({
        where: { productId: { in: productIds }, paidAt: { gte: trackingStart } },
        select: { affiliateId: true, productId: true, paidAt: true, quantity: true, status: true, paymentSettlementStatus: true },
        take: READINESS_MAX_EVENTS + 1,
      })
    : []
  if (orders.length > READINESS_MAX_EVENTS) return null
  const ordersBy = new Map<string, Array<{ affiliateId: string; paidAt: Date; quantity: number; netCents: number; closed: boolean }>>()
  for (const o of orders) {
    if (!o.paidAt || !o.productId || !o.affiliateId) continue
    const k = `${o.productId}\u0000${o.affiliateId}`
    ordersBy.set(k, [...(ordersBy.get(k) ?? []), { affiliateId: o.affiliateId, paidAt: o.paidAt, quantity: Math.max(1, o.quantity ?? 1), netCents: 0, closed: isOrderClosedForPayout({ status: o.status, paymentSettlementStatus: o.paymentSettlementStatus }) }])
  }
  const periods: MeasuredPeriod[] = []
  let unjudged = 0
  for (const [id, l] of byListing) {
    const c = currentBy.get(id)
    const history = rebuildPresence({ current: c ? { isListed: c.isListed, createdAt: c.createdAt } : null, events: l.events, trackingStartedAt: trackingStart })
    const m = measurePeriods({ productId: l.productId, affiliateId: l.affiliateId, history, orders: ordersBy.get(`${l.productId}\u0000${l.affiliateId}`) ?? [] }, now)
    periods.push(...m.periods)
    unjudged += m.unjudged
  }
  const [retention, plan, contextualSnapshots] = await Promise.all([
    tx.auditLog.count({ where: { action: RETENTION_ACTION } }),
    tx.auditLog.count({ where: { action: PLAN_ACTION } }),
    tx.auditLog.count({ where: { action: CH_SNAPSHOT_ACTION } }),
  ])
  const readiness = buildActivationReadiness({
    now,
    migrationApplied: true,
    trackingStartedAt: trackingStart,
    presenceTruncated: false,
    presenceEvents90d: null,
    unattributedShare: null,
    periods,
    unjudgedPeriods: unjudged,
    markers: { retention, plan, contextualSnapshots },
    modes: { blind_spots: "off", temporal: "off", retention: "off", observation_plan: "off", contextual_horizon: "off" },
  })
  const volumes: VolumeFacts = {
    listingsWithHistory: byListing.size,
    products: productIds.length,
    resellers: new Set([...byListing.values()].map((l) => l.affiliateId)).size,
    completePeriods: periods.filter((p) => p.end !== null).length,
    ongoingPeriods: periods.filter((p) => p.end === null).length,
    unjudgedPeriods: unjudged,
    periodsWithSale: periods.filter((p) => p.firstSaleAfterDays !== null).length,
    censoredPeriods: periods.filter((p) => p.firstSaleAfterDays === null).length,
    historyDays: Math.max(0, Math.floor((now.getTime() - trackingStart.getTime()) / DAY)),
  }
  const engines: EngineLine[] = readiness.engines.map((e) => {
    const g = e.gaps.find((x) => x.missing === null || x.missing > 0)
    return { id: e.id, name: e.name, level: e.level, levelLabel: e.levelLabel, state: e.state, mainGap: g ? `${g.metric} : ${g.available ?? "inconnu"} / ${g.required}${g.derived ? " (seuil dérivé)" : ""}` : null }
  })
  return { volumes, engines }
}

/**
 * The whole report. `trackingStartOverride` exists for the CI database only (whose schema is not created by
 * `migrate deploy`, so `_prisma_migrations` has no row); the script never passes it.
 */
const UTC_ZONES = new Set(["utc", "etc/utc", "gmt", "etc/gmt", "uct", "etc/uct", "universal", "etc/universal", "zulu", "etc/zulu", "gmt0", "etc/gmt0", "greenwich", "etc/greenwich", "gmt+0", "gmt-0", "etc/gmt+0", "etc/gmt-0"])

/**
 * Inputs of the mutation / history reconciliation — READ ONLY, bounded (a capped read is said, never concluded on).
 * Witnesses older than the start minus the clock margin are not read: they could never be verified.
 */
export async function collectReconciliation(tx: Tx, trackingStart: Date | null, now: Date, integrity: IntegrityFacts | null): Promise<ReconciliationReport> {
  // The time zone a session gets by default (role / database / server), not this session's own SET.
  const tz = await one<{ v: string | null }>(tx, Prisma.sql`SELECT reset_val AS v FROM pg_settings WHERE name = 'TimeZone'`)
  const clockMarginMs = tz?.v && UTC_ZONES.has(tz.v.toLowerCase()) ? 0 : CLOCK_MARGIN_NON_UTC_MS
  const from = trackingStart ? new Date(trackingStart.getTime() - CLOCK_MARGIN_NON_UTC_MS) : null
  const cap = READINESS_MAX_EVENTS
  const evs = await tx.listingPresenceEvent.findMany({
    orderBy: { id: "asc" },
    take: cap + 1,
    select: { affiliateProductId: true, kind: true, previousListed: true, newListed: true, source: true, effectiveAt: true },
  })
  const listings = await tx.affiliateProduct.findMany({ take: cap + 1, select: { id: true, isListed: true, createdAt: true } })
  let creations: { rows: Array<{ listingId: string; at: Date }>; truncated: boolean } | null = null
  const priceTable = await one<{ t: string | null }>(tx, Prisma.sql`SELECT to_regclass('"ListingPriceHistory"')::text AS t`)
  if (priceTable?.t && from) {
    const first = await rows<{ l: string; at: Date }>(tx, Prisma.sql`SELECT f.l, f.at FROM (
        SELECT DISTINCT ON ("affiliateProductId") "affiliateProductId" AS l, "effectiveAt" AS at, "variantKey" AS vk, "previousCents" AS pc
          FROM "ListingPriceHistory" ORDER BY "affiliateProductId", id) f
       WHERE f.vk IS NULL AND f.pc IS NULL AND f.at >= (${from.toISOString()}::timestamptz AT TIME ZONE 'UTC')
       LIMIT ${cap + 1}`)
    creations = { rows: first.slice(0, cap).map((r) => ({ listingId: r.l, at: r.at })), truncated: first.length > cap }
  }
  const audits = from
    ? await tx.auditLog.findMany({ where: { action: { in: Object.keys(AUDIT_WITNESS_SOURCES) }, createdAt: { gte: from } }, take: cap + 1, select: { entityId: true, action: true, createdAt: true } })
    : []
  return reconcileMutations({
    now,
    trackingStart,
    clockMarginMs,
    events: {
      rows: evs.slice(0, cap).filter((e) => KINDS.includes(e.kind as PresenceKind)).map((e) => ({ listingId: e.affiliateProductId, kind: e.kind as PresenceKind, previousListed: e.previousListed, newListed: e.newListed, source: e.source, effectiveAt: e.effectiveAt })),
      truncated: evs.length > cap,
    },
    listings: { rows: listings.slice(0, cap), truncated: listings.length > cap },
    creations,
    audits: from ? { rows: audits.slice(0, cap).filter((a) => a.entityId).map((a) => ({ listingId: a.entityId!, action: a.action, at: a.createdAt })), truncated: audits.length > cap } : null,
    integrity,
  })
}

export async function collectPresenceReadiness(
  tx: Tx,
  opts: { staticFacts: StaticFacts; now?: Date; trackingStartOverride?: Date },
): Promise<PresenceReadinessReport> {
  const now = opts.now ?? new Date()
  const catalog = await collectCatalogFacts(tx)
  const trackingStart = opts.trackingStartOverride ?? catalog.migrationFinishedAt
  const integrity = catalog.tableExists ? await collectIntegrityFacts(tx, trackingStart) : null
  const vol = catalog.tableExists && trackingStart && integrity && !integrity.truncated ? await collectVolumes(tx, trackingStart, now) : null
  const reconciliation = catalog.tableExists ? await collectReconciliation(tx, trackingStart, now, integrity) : null
  return buildPresenceReadinessReport({
    now,
    staticFacts: opts.staticFacts,
    catalog,
    integrity,
    volumes: vol?.volumes ?? null,
    engines: vol?.engines ?? null,
    databaseNotReadReason: null,
    reconciliation,
  })
}
