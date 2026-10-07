import { describe, expect, it } from "vitest"

import { EVENT_REGISTRY, type EventName } from "@/lib/events/names"
import { EVENT_SCHEMA_VERSION, buildEventRow, type ServerEventInput } from "@/lib/events/row"

const NOW = new Date("2026-10-07T12:00:00Z")
const ANON = "0b9f7c3e-6c1a-4f5e-9d2b-1a2b3c4d5e6f"
const behavioral: ServerEventInput = {
  eventId: "0b9f7c3e-6c1a-4f5e-9d2b-aaaaaaaaaaaa",
  name: "product_view",
  anonymousId: ANON,
  sessionId: "sess_abcdef12",
  userId: "cmuser0000000000000000001",
  productId: "cmprod0000000000000000001",
  channel: "social",
  durationMs: 1500,
  source: "pdp",
  country: "fr",
  locale: "fr",
}
const transactional: ServerEventInput = {
  eventId: "purchase:cmorder000000000000000001",
  name: "purchase",
  // A careless caller hands over every identifier it has: the builder must still keep the journal clean.
  anonymousId: ANON,
  sessionId: "sess_abcdef12",
  channel: "social",
  durationMs: 1500,
  userId: "cmuser0000000000000000001",
  orderId: "cmorder000000000000000001",
  creatorId: "cmcreator00000000000000001",
  supplierId: "cmsupplier0000000000000001",
}

const build = (input: ServerEventInput, analyticsConsent: boolean) => buildEventRow(input, { analyticsConsent, now: NOW })

describe("behavioral events — consent-bound", () => {
  it("are refused without analytics consent", () => {
    expect(build(behavioral, false)).toEqual({ ok: false, reason: "no_consent" })
  })

  it("are recorded with consent, keeping their visitor identifiers and channel", () => {
    const r = build(behavioral, true)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row).toMatchObject({
      eventType: "product_view",
      eventClass: "behavioral",
      anonymousId: ANON,
      sessionId: "sess_abcdef12",
      userId: "cmuser0000000000000000001",
      channel: "social",
      durationMs: 1500,
      source: "pdp",
      country: "FR",
      locale: "fr",
      schemaVersion: EVENT_SCHEMA_VERSION,
    })
  })

  it("every behavioral event name is refused without consent — no exception hiding in the registry", () => {
    for (const name of Object.keys(EVENT_REGISTRY) as EventName[]) {
      if (EVENT_REGISTRY[name].class !== "behavioral") continue
      expect(build({ ...behavioral, name }, false), name).toEqual({ ok: false, reason: "no_consent" })
    }
  })

  it("an unknown channel is dropped, not stored", () => {
    const r = build({ ...behavioral, channel: "tiktok-ads" }, true)
    expect(r.ok && r.row.channel).toBeNull()
  })
})

describe("transactional events — the business journal", () => {
  it("exist whatever the visitor's cookie choices are", () => {
    expect(build(transactional, false).ok).toBe(true)
    expect(build(transactional, true).ok).toBe(true)
  })

  it("never carry a visitor identifier, a marketing channel or a behavioral duration", () => {
    for (const consent of [false, true]) {
      const r = build(transactional, consent)
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.row.eventClass).toBe("transactional")
      expect(r.row.anonymousId).toBeNull()
      expect(r.row.sessionId).toBeNull()
      expect(r.row.channel).toBeNull()
      expect(r.row.durationMs).toBeNull()
    }
  })

  it("keep the business relations: user, order, creator, supplier", () => {
    const r = build(transactional, false)
    expect(r.ok && r.row).toMatchObject({
      userId: "cmuser0000000000000000001",
      orderId: "cmorder000000000000000001",
      creatorId: "cmcreator00000000000000001",
      supplierId: "cmsupplier0000000000000001",
    })
  })

  it("every transactional event name is stripped the same way", () => {
    for (const name of Object.keys(EVENT_REGISTRY) as EventName[]) {
      if (EVENT_REGISTRY[name].class !== "transactional") continue
      const r = build({ ...transactional, name }, false)
      expect(r.ok, name).toBe(true)
      if (r.ok) expect([r.row.anonymousId, r.row.sessionId, r.row.channel]).toEqual([null, null, null])
    }
  })
})

describe("rules shared by both classes", () => {
  it("an unknown event name is refused (prototype keys included)", () => {
    for (const name of ["", "nope", "Purchase", "__proto__", "toString"]) {
      expect(build({ ...behavioral, name }, true), name).toEqual({ ok: false, reason: "unknown_event" })
    }
  })

  it("no valid idempotency key, no event", () => {
    for (const eventId of ["", "short", "has spaces in it", "x".repeat(201)]) {
      expect(build({ ...transactional, eventId }, true), eventId).toEqual({ ok: false, reason: "invalid_event_id" })
    }
    expect(build({ ...transactional, eventId: undefined as never }, true)).toEqual({ ok: false, reason: "invalid_event_id" })
  })

  it("malformed ids are dropped from the row, not stored — the event itself survives", () => {
    const r = build({ ...transactional, orderId: "x y z; DROP", creatorId: "<b>", supplierId: "cmsupplier0000000000000001" }, false)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.orderId).toBeNull()
    expect(r.row.creatorId).toBeNull()
    expect(r.row.supplierId).toBe("cmsupplier0000000000000001")
  })

  it("occurredAt: a transactional event keeps the ledger date; a behavioral one is clamped", () => {
    const sixMonthsAgo = new Date(NOW.getTime() - 180 * 86_400_000)
    const tr = build({ ...transactional, occurredAt: sixMonthsAgo }, false)
    expect(tr.ok && tr.row.occurredAt.getTime()).toBe(sixMonthsAgo.getTime())
    const be = build({ ...behavioral, occurredAt: sixMonthsAgo }, true)
    expect(be.ok && be.row.occurredAt.getTime()).toBe(NOW.getTime())
    const future = build({ ...behavioral, occurredAt: new Date(NOW.getTime() + 3_600_000) }, true)
    expect(future.ok && future.row.occurredAt.getTime()).toBe(NOW.getTime())
  })

  it("properties are whitelisted per event", () => {
    const r = build({ ...transactional, properties: { amount_cents: 4990, currency: "eur", email: "buyer@example.com", utm_source: "x" } }, false)
    expect(r.ok && r.row.properties).toEqual({ amount_cents: 4990, currency: "EUR" })
    const none = build({ ...transactional, properties: { email: "buyer@example.com" } }, false)
    expect(none.ok && none.row.properties).toBeNull()
  })

  it("is deterministic: same input, same row", () => {
    expect(build(transactional, false)).toEqual(build({ ...transactional }, false))
  })
})
