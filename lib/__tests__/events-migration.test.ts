import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const SQL = readFileSync("prisma/migrations/20261007140000_event_spine/migration.sql", "utf8")
const SCHEMA = readFileSync("prisma/schema.prisma", "utf8")

const model = SCHEMA.slice(SCHEMA.indexOf("model AffisellTrackEvent {"), SCHEMA.indexOf("model CommunityPost {"))
const fieldNames = [...model.matchAll(/^\s{2}([a-zA-Z]+)\s+\S+/gm)]
  .map((m) => m[1]!)
  .filter((n) => !["id", "eventType", "productId", "sessionId", "userId", "durationMs", "createdAt"].includes(n))

describe("event_spine migration", () => {
  it("is explicit: it never hides a schema drift behind IF NOT EXISTS", () => {
    expect(SQL.toLowerCase()).not.toContain("if not exists")
    expect(SQL.toLowerCase()).not.toContain("if exists")
  })

  it("adds, one for one, the columns the Prisma model declares as new (schema and SQL cannot drift apart)", () => {
    const added = [...SQL.matchAll(/ADD COLUMN\s+"([A-Za-z]+)"/g)].map((m) => m[1]!).sort()
    expect(added).toEqual([...fieldNames].sort())
    expect(added).toHaveLength(15)
  })

  it("only adds: no drop, no rename, no type change, no data rewrite", () => {
    for (const word of ["DROP COLUMN", "DROP TABLE", "RENAME", "ALTER COLUMN", "UPDATE ", "DELETE ", "TRUNCATE"]) {
      expect(SQL, word).not.toContain(word)
    }
  })

  it("every new column is nullable, so every existing row stays valid", () => {
    for (const line of SQL.split("\n").filter((l) => l.includes("ADD COLUMN"))) {
      expect(line).not.toMatch(/NOT NULL/)
    }
  })

  it("the idempotency key is unique", () => {
    expect(SQL).toContain('CREATE UNIQUE INDEX "AffisellTrackEvent_eventId_key" ON "AffisellTrackEvent"("eventId")')
  })

  it("the separation between the two classes is enforced by the database itself", () => {
    expect(SQL).toContain(`"eventClass" IN ('behavioral', 'transactional')`)
    expect(SQL).toMatch(/"eventClass" IS DISTINCT FROM 'transactional' OR \("anonymousId" IS NULL AND "sessionId" IS NULL\)/)
    expect(SQL).toMatch(/"eventClass" IS NULL OR "eventId" IS NOT NULL/)
  })

  it("leaves the existing indexes alone and does not touch AffiliateProduct.clicks", () => {
    expect(SQL).not.toContain("AffiliateProduct")
    expect(SQL).not.toMatch(/DROP INDEX/)
  })
})
