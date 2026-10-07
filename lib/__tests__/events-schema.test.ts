import { describe, expect, it } from "vitest"

import { MAX_BATCH_BYTES, MAX_BATCH_EVENTS, clientEventSchema, isBatchSizeAcceptable, parseClientBatch } from "@/lib/events/schema"

const uuid = () => crypto.randomUUID()
const ok = (extra: Record<string, unknown> = {}) => ({ eventId: uuid(), name: "product_view", productId: "cmpmibth80001la04ysgbjef6", ...extra })

describe("what a browser may send", () => {
  it("accepts a well-formed behavioral event", () => {
    const parsed = clientEventSchema.safeParse(
      ok({ clientTs: Date.now(), sessionId: "sess_abcdef12", listingId: "cmpmibth80001la04ysgbjef7", properties: { surface: "grid", position: 3 } })
    )
    expect(parsed.success).toBe(true)
  })

  it("refuses every business fact: a browser is not a witness of a purchase, a refund or a delivery", () => {
    for (const name of ["purchase", "refund", "return_requested", "return_resolved", "delivery", "review_created", "creator_product_added", "creator_product_removed"]) {
      expect(clientEventSchema.safeParse(ok({ name })).success, name).toBe(false)
    }
  })

  it("refuses server-only behavioral events too", () => {
    for (const name of ["checkout_started", "creator_share", "checkout_initiated"]) {
      expect(clientEventSchema.safeParse(ok({ name })).success, name).toBe(false)
    }
  })

  it("is STRICT: a browser cannot set identity, entity or marketing fields — the server derives them", () => {
    for (const field of ["userId", "anonymousId", "creatorId", "storeId", "supplierId", "orderId", "country", "locale", "channel", "source", "eventClass", "schemaVersion", "occurredAt"]) {
      expect(clientEventSchema.safeParse(ok({ [field]: "cmpmibth80001la04ysgbjef6" })).success, field).toBe(false)
    }
  })

  it("requires a real UUID as idempotency key", () => {
    for (const eventId of ["", "abc", "purchase:cmpmibth80001la04ysgbjef6", "not-a-uuid-at-all-not-a-uuid-at-all!", 12345]) {
      expect(clientEventSchema.safeParse(ok({ eventId })).success, String(eventId)).toBe(false)
    }
  })

  it("rejects malformed ids, durations and times", () => {
    expect(clientEventSchema.safeParse(ok({ productId: "x" })).success).toBe(false)
    expect(clientEventSchema.safeParse(ok({ productId: "<script>alert(1)</script>" })).success).toBe(false)
    expect(clientEventSchema.safeParse(ok({ sessionId: "no" })).success).toBe(false)
    expect(clientEventSchema.safeParse(ok({ durationMs: -1 })).success).toBe(false)
    expect(clientEventSchema.safeParse(ok({ durationMs: 600_001 })).success).toBe(false)
    expect(clientEventSchema.safeParse(ok({ clientTs: 1.5 })).success).toBe(false)
    expect(clientEventSchema.safeParse(ok({ clientTs: "yesterday" })).success).toBe(false)
  })
})

describe("parseClientBatch — one bad event never costs the others", () => {
  it("keeps the valid events and counts the rejected ones", () => {
    const r = parseClientBatch({ events: [ok(), { name: "purchase" }, ok({ name: "search" }), "junk", null, ok({ userId: "x".repeat(10) })] })
    expect(r.envelopeError).toBeNull()
    expect(r.events.map((e) => e.name)).toEqual(["product_view", "search"])
    expect(r.rejected).toBe(4)
  })

  it("refuses an unusable envelope", () => {
    expect(parseClientBatch(null).envelopeError).toBe("not_an_object")
    expect(parseClientBatch("x").envelopeError).toBe("not_an_object")
    expect(parseClientBatch([ok()]).envelopeError).toBe("not_an_object")
    expect(parseClientBatch({}).envelopeError).toBe("no_events")
    expect(parseClientBatch({ events: [] }).envelopeError).toBe("no_events")
    expect(parseClientBatch({ events: "nope" }).envelopeError).toBe("no_events")
  })

  it(`refuses more than ${MAX_BATCH_EVENTS} events in one request, whatever they are`, () => {
    const events = Array.from({ length: MAX_BATCH_EVENTS + 1 }, () => ok())
    const r = parseClientBatch({ events })
    expect(r.envelopeError).toBe("too_many_events")
    expect(r.events).toEqual([])
    expect(parseClientBatch({ events: events.slice(0, MAX_BATCH_EVENTS) }).events).toHaveLength(MAX_BATCH_EVENTS)
  })

  it("never throws on hostile input", () => {
    const hostile: unknown[] = [undefined, 0, NaN, Symbol.iterator.toString(), { events: { length: 5 } }, { events: [() => 1] }, { events: [[[]]] }, Object.create(null)]
    for (const h of hostile) expect(() => parseClientBatch(h)).not.toThrow()
  })

  it("the body size gate", () => {
    expect(isBatchSizeAcceptable(1)).toBe(true)
    expect(isBatchSizeAcceptable(MAX_BATCH_BYTES)).toBe(true)
    expect(isBatchSizeAcceptable(MAX_BATCH_BYTES + 1)).toBe(false)
    expect(isBatchSizeAcceptable(0)).toBe(false)
    expect(isBatchSizeAcceptable(Number.NaN)).toBe(false)
  })
})
