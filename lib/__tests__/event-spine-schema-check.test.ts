import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { isReadOnlySql } from "@/lib/build-write-guard"
import {
  EVENT_SPINE_CATALOG_SQL,
  EVENT_SPINE_CHECKS,
  EVENT_SPINE_COLUMNS,
  EVENT_SPINE_INDEXES,
  EVENT_SPINE_UNIQUE_INDEX,
  evaluateEventSpineSchema,
  type EventSpineCatalog,
} from "@/lib/events/schema-check"

/**
 * The old deploy pipeline (prisma/fix-p3009-migrations.sql, /api/cron/migrate — removed in S1.6) could record a half-failed
 * migration as applied, so `prisma migrate status` alone proves nothing about the columns of a database that went through it.
 * The catalog does; this is the expectation it is compared to, and the gate `npm run schema:verify` / `schema:migrate` enforce.
 */

const SQL = readFileSync("prisma/migrations/20261007140000_event_spine/migration.sql", "utf8")

describe("the expectation cannot drift from the migration", () => {
  it("columns", () => {
    const added = [...SQL.matchAll(/ADD COLUMN\s+"([A-Za-z]+)"/g)].map((m) => m[1]!).sort()
    expect(added).toEqual([...EVENT_SPINE_COLUMNS].sort())
  })

  it("unique index and indexes", () => {
    expect([...SQL.matchAll(/CREATE UNIQUE INDEX "([^"]+)"/g)].map((m) => m[1])).toEqual([EVENT_SPINE_UNIQUE_INDEX])
    expect([...SQL.matchAll(/CREATE INDEX "([^"]+)"/g)].map((m) => m[1]!).sort()).toEqual([...EVENT_SPINE_INDEXES].sort())
  })

  it("CHECK constraints", () => {
    const names = [...SQL.matchAll(/ADD CONSTRAINT "([^"]+)"/g)].map((m) => m[1]!).sort()
    expect(names).toEqual(EVENT_SPINE_CHECKS.map((c) => c.name).sort())
  })
})

describe("the catalog queries are read-only constants", () => {
  it.each(Object.entries(EVENT_SPINE_CATALOG_SQL))("%s", (_name, sql) => {
    expect(isReadOnlySql(sql)).toBe(true)
  })
})

/** What PostgreSQL really reports for the S1 schema (copied from the staging database after the migration). */
function presentCatalog(): EventSpineCatalog {
  return {
    columns: [{ column_name: "id" }, { column_name: "eventType" }, ...EVENT_SPINE_COLUMNS.map((c) => ({ column_name: c }))],
    indexes: [
      { indexname: "AffisellTrackEvent_pkey", indexdef: 'CREATE UNIQUE INDEX "AffisellTrackEvent_pkey" ON public."AffisellTrackEvent" USING btree (id)' },
      { indexname: EVENT_SPINE_UNIQUE_INDEX, indexdef: `CREATE UNIQUE INDEX "${EVENT_SPINE_UNIQUE_INDEX}" ON public."AffisellTrackEvent" USING btree ("eventId")` },
      ...EVENT_SPINE_INDEXES.map((name) => ({ indexname: name, indexdef: `CREATE INDEX "${name}" ON public."AffisellTrackEvent" USING btree ("creatorId", "createdAt")` })),
    ],
    constraints: [
      {
        conname: "AffisellTrackEvent_eventClass_check",
        def: `CHECK ((("eventClass" IS NULL) OR ("eventClass" = ANY (ARRAY['behavioral'::text, 'transactional'::text]))))`,
      },
      {
        conname: "AffisellTrackEvent_transactional_no_visitor_ids_check",
        def: `CHECK ((("eventClass" IS DISTINCT FROM 'transactional'::text) OR (("anonymousId" IS NULL) AND ("sessionId" IS NULL))))`,
      },
      { conname: "AffisellTrackEvent_spine_has_event_id_check", def: `CHECK ((("eventClass" IS NULL) OR ("eventId" IS NOT NULL)))` },
    ],
  }
}

describe("evaluateEventSpineSchema", () => {
  it("present: everything the migration creates is there", () => {
    const report = evaluateEventSpineSchema(presentCatalog())
    expect(report).toMatchObject({ state: "present", missing: [] })
    expect(report.found).toHaveLength(EVENT_SPINE_COLUMNS.length + 1 + EVENT_SPINE_INDEXES.length + EVENT_SPINE_CHECKS.length)
  })

  it("absent: the database before the migration (production today)", () => {
    const before: EventSpineCatalog = {
      columns: ["id", "eventType", "productId", "sessionId", "userId", "durationMs", "createdAt"].map((c) => ({ column_name: c })),
      indexes: [{ indexname: "AffisellTrackEvent_pkey", indexdef: 'CREATE UNIQUE INDEX "AffisellTrackEvent_pkey" ON public."AffisellTrackEvent" USING btree (id)' }],
      constraints: [],
    }
    const report = evaluateEventSpineSchema(before)
    expect(report.state).toBe("absent")
    expect(report.found).toEqual([])
  })

  it("an empty catalog (the table does not exist) is absent, not an error", () => {
    expect(evaluateEventSpineSchema({ columns: [], indexes: [], constraints: [] }).state).toBe("absent")
  })

  it("PARTIAL — the dangerous state: a half-applied migration recorded as done", () => {
    const columnsOnly = presentCatalog()
    columnsOnly.constraints = []
    columnsOnly.indexes = columnsOnly.indexes.filter((i) => i.indexname === "AffisellTrackEvent_pkey")
    const report = evaluateEventSpineSchema(columnsOnly)
    expect(report.state).toBe("partial")
    expect(report.missing).toEqual(expect.arrayContaining([`unique index ${EVENT_SPINE_UNIQUE_INDEX}`, "check AffisellTrackEvent_spine_has_event_id_check"]))
  })

  it("one missing column is partial and named", () => {
    const catalog = presentCatalog()
    catalog.columns = catalog.columns.filter((c) => c.column_name !== "anonymousId")
    const report = evaluateEventSpineSchema(catalog)
    expect(report.state).toBe("partial")
    expect(report.missing).toEqual(["column anonymousId"])
  })

  it("a constraint that exists but says something else does not count", () => {
    const catalog = presentCatalog()
    catalog.constraints = catalog.constraints.map((c) =>
      c.conname === "AffisellTrackEvent_transactional_no_visitor_ids_check" ? { ...c, def: `CHECK (("anonymousId" IS NULL))` } : c
    )
    const report = evaluateEventSpineSchema(catalog)
    expect(report.state).toBe("partial")
    expect(report.missing).toEqual(["check AffisellTrackEvent_transactional_no_visitor_ids_check"])
  })

  it("an eventId index that is not UNIQUE does not count (idempotency would silently be gone)", () => {
    const catalog = presentCatalog()
    catalog.indexes = catalog.indexes.map((i) =>
      i.indexname === EVENT_SPINE_UNIQUE_INDEX ? { ...i, indexdef: `CREATE INDEX "${EVENT_SPINE_UNIQUE_INDEX}" ON public."AffisellTrackEvent" USING btree ("eventId")` } : i
    )
    const report = evaluateEventSpineSchema(catalog)
    expect(report.state).toBe("partial")
    expect(report.missing).toEqual([`unique index ${EVENT_SPINE_UNIQUE_INDEX}`])
  })
})
