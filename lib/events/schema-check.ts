/**
 * Is the event-spine schema REALLY in the database?
 *
 * `prisma migrate status` alone is not enough to answer that: until S1.6 the deploy pipeline (prisma/fix-p3009-migrations.sql
 * and /api/cron/migrate, both removed) marked a migration that stayed unfinished as FINISHED without running it again, so a
 * migration that failed half-way could be recorded as applied while its columns do not exist — and a database that went
 * through that period may still hold such a record. The only reliable proof is the catalog itself. This module holds the
 * expectation and the comparison (pure, tested against the migration file so they cannot drift apart);
 * `scripts/verify-event-spine.ts` runs it, read-only, and `npm run schema:verify` / `schema:migrate` make it a hard gate.
 */

/** The 15 columns the `event_spine` migration adds to "AffisellTrackEvent". */
export const EVENT_SPINE_COLUMNS = [
  "anonymousId",
  "channel",
  "country",
  "creatorId",
  "eventClass",
  "eventId",
  "listingId",
  "locale",
  "occurredAt",
  "orderId",
  "properties",
  "schemaVersion",
  "source",
  "storeId",
  "supplierId",
] as const

export const EVENT_SPINE_UNIQUE_INDEX = "AffisellTrackEvent_eventId_key"

export const EVENT_SPINE_INDEXES = [
  "AffisellTrackEvent_anonymousId_createdAt_idx",
  "AffisellTrackEvent_creatorId_createdAt_idx",
  "AffisellTrackEvent_orderId_idx",
] as const

/** Each CHECK constraint and the fragments its definition must contain (the catalog normalises the exact text). */
export const EVENT_SPINE_CHECKS: ReadonlyArray<{ name: string; mustContain: readonly string[] }> = [
  { name: "AffisellTrackEvent_eventClass_check", mustContain: ["behavioral", "transactional"] },
  {
    name: "AffisellTrackEvent_transactional_no_visitor_ids_check",
    mustContain: ["transactional", "anonymousId", "sessionId", "IS NULL"],
  },
  { name: "AffisellTrackEvent_spine_has_event_id_check", mustContain: ["eventId", "IS NOT NULL"] },
]

/** The three read-only catalog queries. Constants: nothing here is ever built from input. */
export const EVENT_SPINE_CATALOG_SQL = {
  columns: `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'AffisellTrackEvent'`,
  indexes: `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'AffisellTrackEvent'`,
  constraints: `select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = to_regclass('public."AffisellTrackEvent"') and contype = 'c'`,
} as const

export type EventSpineCatalog = {
  columns: ReadonlyArray<{ column_name: string }>
  indexes: ReadonlyArray<{ indexname: string; indexdef: string }>
  constraints: ReadonlyArray<{ conname: string; def: string }>
}

export type EventSpineSchemaReport = {
  /** `absent` = none of it; `present` = all of it; `partial` = SOMETHING IS WRONG (e.g. a failed migration recorded as applied). */
  state: "absent" | "present" | "partial"
  missing: string[]
  found: string[]
}

export function evaluateEventSpineSchema(catalog: EventSpineCatalog): EventSpineSchemaReport {
  const found: string[] = []
  const missing: string[] = []
  const note = (ok: boolean, label: string) => (ok ? found : missing).push(label)

  const columns = new Set(catalog.columns.map((c) => c.column_name))
  for (const column of EVENT_SPINE_COLUMNS) note(columns.has(column), `column ${column}`)

  const indexes = new Map(catalog.indexes.map((i) => [i.indexname, i.indexdef]))
  const unique = indexes.get(EVENT_SPINE_UNIQUE_INDEX)
  note(Boolean(unique && /UNIQUE/i.test(unique) && unique.includes('"eventId"')), `unique index ${EVENT_SPINE_UNIQUE_INDEX}`)
  for (const name of EVENT_SPINE_INDEXES) note(indexes.has(name), `index ${name}`)

  const constraints = new Map(catalog.constraints.map((c) => [c.conname, c.def]))
  for (const check of EVENT_SPINE_CHECKS) {
    const def = constraints.get(check.name)
    note(Boolean(def && check.mustContain.every((fragment) => def.includes(fragment))), `check ${check.name}`)
  }

  const state = missing.length === 0 ? "present" : found.length === 0 ? "absent" : "partial"
  return { state, missing, found }
}
