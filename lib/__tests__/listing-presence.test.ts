import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { listedDaysInWindow, presenceSummary, rebuildPresence, type PresenceEvent } from "@/lib/listing-presence/periods"
import { isListingPresenceSource, LISTING_PRESENCE_SOURCES, sanitizePresenceActor } from "@/lib/listing-presence/sources"

const d = (s: string) => new Date(`${s}T12:00:00Z`)
const ev = (kind: PresenceEvent["kind"], at: string, prev: boolean | null, next: boolean | null): PresenceEvent => ({ kind, effectiveAt: d(at), previousListed: prev, newListed: next })
const TRACK = d("2026-12-01")

describe("rebuildPresence — exact history", () => {
  // The founder's example: added 3 Jan, withdrawn 18 Jan, back 2 Feb, withdrawn 20 Feb.
  const h = rebuildPresence({
    current: { isListed: false, createdAt: d("2027-01-03") },
    trackingStartedAt: TRACK,
    events: [ev("created", "2027-01-03", null, true), ev("unlisted", "2027-01-18", true, false), ev("listed", "2027-02-02", false, true), ev("unlisted", "2027-02-20", true, false)],
  })

  it("keeps two distinct periods, never one stretched period", () => {
    expect(h.status).toBe("historique_exact")
    expect(h.periods).toHaveLength(2)
    expect(h.periods[0]).toMatchObject({ start: d("2027-01-03"), end: d("2027-01-18"), startKnown: true, ongoing: false })
    expect(h.periods[1]).toMatchObject({ start: d("2027-02-02"), end: d("2027-02-20"), ongoing: false })
  })

  it("counts withdrawals, relistings and the gap between them", () => {
    expect(h.withdrawals).toBe(2)
    expect(h.relistings).toBe(1)
    expect(h.gapsDays).toEqual([15])
  })

  it("cumulative listed time = 15 + 18 days, the gap excluded", () => {
    const s = presenceSummary(h, d("2027-03-01"))
    expect(s.cumulativeListedDays).toBe(33)
    expect(s.cumulativeExact).toBe(true)
    expect(s.finishedPeriods).toBe(2)
    expect(s.activePeriods).toBe(0)
    expect(s.medianGapDays).toBe(15)
  })

  it("an ongoing period is never treated as finished", () => {
    const live = rebuildPresence({ current: { isListed: true, createdAt: d("2027-01-03") }, trackingStartedAt: TRACK, events: [ev("created", "2027-01-03", null, true)] })
    expect(live.periods[0]).toMatchObject({ end: null, ongoing: true })
    expect(presenceSummary(live, d("2027-01-13")).cumulativeListedDays).toBe(10)
    expect(presenceSummary(live, d("2027-01-13")).activePeriods).toBe(1)
  })

  it("a listing created unlisted then listed: its first listing is not a relisting", () => {
    const h2 = rebuildPresence({
      current: { isListed: true, createdAt: d("2027-01-03") },
      trackingStartedAt: TRACK,
      events: [ev("created", "2027-01-03", null, false), ev("listed", "2027-01-10", false, true)],
    })
    expect(h2.relistings).toBe(0)
    expect(h2.periods).toHaveLength(1)
    expect(h2.periods[0]!.start).toEqual(d("2027-01-10"))
  })

  it("a deletion while listed closes the period and is a withdrawal", () => {
    const h3 = rebuildPresence({ current: null, trackingStartedAt: TRACK, events: [ev("created", "2027-01-03", null, true), ev("deleted", "2027-01-08", true, null)] })
    expect(h3.deleted).toBe(true)
    expect(h3.withdrawals).toBe(1)
    expect(h3.periods[0]).toMatchObject({ end: d("2027-01-08"), ongoing: false })
  })
})

describe("rebuildPresence — listings older than the history", () => {
  it("a listing live before history began: start UNKNOWN, never its createdAt", () => {
    const h = rebuildPresence({ current: { isListed: true, createdAt: d("2026-06-01") }, trackingStartedAt: TRACK, events: [] })
    expect(h.status).toBe("debut_inconnu")
    expect(h.periods[0]).toMatchObject({ start: null, startKnown: false, startLowerBound: d("2026-06-01"), ongoing: true })
    // Counted only from when history began: 31 days, not 214.
    expect(listedDaysInWindow(h, d("2026-06-01"), d("2027-01-01"))).toMatchObject({ listedDays: 31, exact: false })
  })

  it("its state before the first event comes from the event itself", () => {
    const h = rebuildPresence({ current: { isListed: false, createdAt: d("2026-06-01") }, trackingStartedAt: TRACK, events: [ev("unlisted", "2026-12-10", true, false)] })
    expect(h.periods).toHaveLength(1)
    expect(h.periods[0]).toMatchObject({ start: null, end: d("2026-12-10"), startKnown: false })
    expect(h.withdrawals).toBe(1)
  })

  it("a listing unlisted before history and never touched has no period", () => {
    const h = rebuildPresence({ current: { isListed: false, createdAt: d("2026-06-01") }, trackingStartedAt: TRACK, events: [] })
    expect(h.periods).toHaveLength(0)
    expect(h.status).toBe("historique_exact")
  })

  it("no history at all = unavailable, nothing invented", () => {
    const h = rebuildPresence({ current: { isListed: true, createdAt: d("2026-06-01") }, trackingStartedAt: null, events: [] })
    expect(h.status).toBe("indisponible")
    expect(h.periods).toEqual([])
    expect(listedDaysInWindow(h, d("2026-12-01"), d("2026-12-11"))).toMatchObject({ listedDays: 0, unknownDays: 10, exact: false })
  })
})

describe("rebuildPresence — missing events are said, not guessed", () => {
  it("an event whose previous state disagrees flags the listing and leaves the edge unknown", () => {
    const h = rebuildPresence({
      current: { isListed: false, createdAt: d("2027-01-01") },
      trackingStartedAt: TRACK,
      // listed, then « unlisted » with previousListed false: an unlisting and a relisting were never recorded.
      events: [ev("created", "2027-01-01", null, true), ev("listed", "2027-01-20", false, true), ev("unlisted", "2027-01-25", true, false)],
    })
    expect(h.status).toBe("incoherent")
    expect(h.consistent).toBe(false)
    expect(h.periods[0]).toMatchObject({ end: null, uncertain: true, ongoing: false })
    // The uncertain period is unknown time, never listed time.
    const w = listedDaysInWindow(h, d("2027-01-01"), d("2027-02-01"))
    expect(w.exact).toBe(false)
    expect(w.listedDays).toBe(5)
  })

  it("the row today disagreeing with the last event is flagged too", () => {
    const h = rebuildPresence({ current: { isListed: true, createdAt: d("2027-01-01") }, trackingStartedAt: TRACK, events: [ev("created", "2027-01-01", null, false)] })
    expect(h.status).toBe("incoherent")
    expect(h.periods[0]).toMatchObject({ start: null, uncertain: true })
  })
})

describe("listedDaysInWindow — 3 days vs 30 days of presence", () => {
  it("tells a product listed 3 days from one listed 30 days", () => {
    const short = rebuildPresence({ current: { isListed: false, createdAt: d("2027-01-01") }, trackingStartedAt: TRACK, events: [ev("created", "2027-01-01", null, true), ev("unlisted", "2027-01-04", true, false)] })
    const long = rebuildPresence({ current: { isListed: true, createdAt: d("2027-01-01") }, trackingStartedAt: TRACK, events: [ev("created", "2027-01-01", null, true)] })
    expect(listedDaysInWindow(short, d("2027-01-01"), d("2027-01-31")).listedDays).toBe(3)
    expect(listedDaysInWindow(long, d("2027-01-01"), d("2027-01-31")).listedDays).toBe(30)
  })
})

describe("sources and minimisation", () => {
  it("only declared codes; actor ids sanitised", () => {
    expect(isListingPresenceSource("replacement")).toBe(true)
    expect(isListingPresenceSource("anything")).toBe(false)
    expect(sanitizePresenceActor("ck_abc-1")).toBe("ck_abc-1")
    expect(sanitizePresenceActor("a@b.c")).toBeNull()
    for (const s of LISTING_PRESENCE_SOURCES) expect(s).toMatch(/^[a-z0-9_.:-]{1,64}$/)
  })

  it("the migration stores no buyer data and no free text, and the table is append-only", () => {
    const sql = readFileSync("prisma/migrations/20261124090000_listing_presence_history/migration.sql", "utf8")
    const table = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS "ListingPresenceEvent"'), sql.indexOf("CONSTRAINT \"ListingPresenceEvent_pkey\""))
    const cols = [...table.matchAll(/^\s+"(\w+)"/gm)].map((m) => m[1])
    expect(cols).toEqual(["id", "affiliateProductId", "affiliateId", "productId", "kind", "previousListed", "newListed", "source", "actorId", "effectiveAt"])
    expect(sql).toMatch(/AFTER INSERT OR UPDATE OF "isListed" OR DELETE ON "AffiliateProduct"/)
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON "ListingPresenceEvent"/)
    expect(sql).not.toMatch(/INSERT INTO "ListingPresenceEvent"[\s\S]*SELECT[\s\S]*FROM "AffiliateProduct"/) // no backfill
  })

  it("the reseller route reads only its own listing and never exposes the actor", () => {
    const src = readFileSync("app/api/affiliate/listings/[id]/presence/route.ts", "utf8")
    expect(src).toMatch(/role !== "AFFILIATE"/)
    expect(src).not.toMatch(/actorId|affiliateId:/)
    const server = readFileSync("lib/listing-presence/presence.server.ts", "utf8")
    expect(server).toMatch(/where: \{ affiliateProductId: listing\.id, affiliateId \}/)
  })
})
