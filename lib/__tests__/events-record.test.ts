import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ createMany: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ prisma: { affisellTrackEvent: { createMany: m.createMany } } }))

import type { ServerEventInput } from "@/lib/events/row"

const ANON = "0b9f7c3e-6c1a-4f5e-9d2b-1a2b3c4d5e6f"
const ctx = (analyticsConsent: boolean) => ({ analyticsConsent, now: new Date("2026-10-07T12:00:00Z") })

const view = (n: number): ServerEventInput => ({
  eventId: `0b9f7c3e-6c1a-4f5e-9d2b-${String(n).padStart(12, "0")}`,
  name: "product_view",
  anonymousId: ANON,
  productId: "cmprod0000000000000000001",
})
const purchase = (orderId: string): ServerEventInput => ({
  eventId: `purchase:${orderId}`,
  name: "purchase",
  orderId,
  anonymousId: ANON,
  properties: { amount_cents: 4990, currency: "EUR" },
})

const driftError = (code: string) => new Prisma.PrismaClientKnownRequestError("column does not exist", { code, clientVersion: "test" })

let recordEvents: (typeof import("@/lib/events/record.server"))["recordEvents"]

beforeEach(async () => {
  m.createMany.mockReset()
  m.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  vi.resetModules()
  ;({ recordEvents } = await import("@/lib/events/record.server"))
})

describe("recordEvents — consent and classes", () => {
  it("behavioral events are not stored without consent, and the database is not even called", async () => {
    const r = await recordEvents([view(1), view(2)], ctx(false))
    expect(r).toMatchObject({ received: 2, written: 0, dropped: { no_consent: 2 }, error: null })
    expect(m.createMany).not.toHaveBeenCalled()
  })

  it("transactional events are stored without consent — and without any visitor identifier", async () => {
    const r = await recordEvents([purchase("cmorder000000000000000001")], ctx(false))
    expect(r).toMatchObject({ received: 1, written: 1, error: null })
    const row = m.createMany.mock.calls[0]![0].data[0]
    expect(row).toMatchObject({ eventClass: "transactional", eventType: "purchase", eventId: "purchase:cmorder000000000000000001", schemaVersion: 1 })
    expect(row.anonymousId).toBeNull()
    expect(row.sessionId).toBeNull()
    expect(row.channel).toBeNull()
    expect(row.properties).toEqual({ amount_cents: 4990, currency: "EUR" })
  })

  it("a mixed batch without consent keeps exactly the business facts", async () => {
    const r = await recordEvents([view(1), purchase("cmorder000000000000000001"), view(2)], ctx(false))
    expect(r.written).toBe(1)
    expect(r.dropped).toEqual({ no_consent: 2 })
    expect(m.createMany.mock.calls[0]![0].data.map((d: { eventType: string }) => d.eventType)).toEqual(["purchase"])
  })

  it("with consent, both classes are stored", async () => {
    const r = await recordEvents([view(1), purchase("cmorder000000000000000001")], ctx(true))
    expect(r.written).toBe(2)
    const rows = m.createMany.mock.calls[0]![0].data as Array<{ eventClass: string; anonymousId: string | null }>
    expect(rows.find((x) => x.eventClass === "behavioral")!.anonymousId).toBe(ANON)
    expect(rows.find((x) => x.eventClass === "transactional")!.anonymousId).toBeNull()
  })
})

describe("recordEvents — idempotency", () => {
  it("always writes with skipDuplicates (INSERT … ON CONFLICT DO NOTHING on the unique eventId)", async () => {
    await recordEvents([view(1)], ctx(true))
    expect(m.createMany.mock.calls[0]![0].skipDuplicates).toBe(true)
  })

  it("the same eventId twice in one batch is one row", async () => {
    const r = await recordEvents([view(1), view(1), view(1)], ctx(true))
    expect(r).toMatchObject({ received: 3, written: 1, duplicates: 2 })
    expect(m.createMany.mock.calls[0]![0].data).toHaveLength(1)
  })

  it("a replay of already-stored events (the database reports 0 inserted) is counted as duplicates, not as an error", async () => {
    m.createMany.mockResolvedValue({ count: 0 })
    const r = await recordEvents([purchase("cmorder000000000000000001"), purchase("cmorder000000000000000002")], ctx(false))
    expect(r).toMatchObject({ written: 0, duplicates: 2, error: null })
  })

  it("a partially-known batch reports exactly what was new", async () => {
    m.createMany.mockResolvedValue({ count: 1 })
    const r = await recordEvents([view(1), view(2)], ctx(true))
    expect(r).toMatchObject({ written: 1, duplicates: 1, error: null })
  })
})

describe("recordEvents — invalid input never reaches the database", () => {
  it("drops unknown events and events without a valid key, and counts why", async () => {
    const r = await recordEvents(
      [
        { eventId: "0b9f7c3e-6c1a-4f5e-9d2b-000000000001", name: "totally_made_up" },
        { eventId: "bad", name: "purchase" },
        purchase("cmorder000000000000000003"),
      ],
      ctx(true)
    )
    expect(r).toMatchObject({ received: 3, written: 1, dropped: { unknown_event: 1, invalid_event_id: 1 } })
  })

  it("an empty call does nothing", async () => {
    const r = await recordEvents([], ctx(true))
    expect(r).toMatchObject({ received: 0, written: 0, error: null })
    expect(m.createMany).not.toHaveBeenCalled()
  })

  it("an all-invalid batch does not call the database", async () => {
    await recordEvents([{ eventId: "x", name: "nope" }], ctx(true))
    expect(m.createMany).not.toHaveBeenCalled()
  })
})

describe("recordEvents — large batches", () => {
  it("are written in chunks of 500", async () => {
    const many = Array.from({ length: 1201 }, (_, i) => purchase(`cmorder${String(i).padStart(18, "0")}`))
    const r = await recordEvents(many, ctx(false))
    expect(r.written).toBe(1201)
    expect(m.createMany.mock.calls.map((c) => c[0].data.length)).toEqual([500, 500, 201])
  })
})

describe("recordEvents — NEVER throws", () => {
  it("a database that has not been migrated yet is reported once, loudly, and not thrown", async () => {
    m.createMany.mockRejectedValue(driftError("P2022"))
    const first = await recordEvents([purchase("cmorder000000000000000001")], ctx(false))
    expect(first).toMatchObject({ written: 0, error: "schema_unavailable" })
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls[0])).toContain("migrate deploy")
    await recordEvents([purchase("cmorder000000000000000002")], ctx(false))
    expect(console.error).toHaveBeenCalledTimes(1) // not once per request
  })

  it("a missing table (P2021) is the same case", async () => {
    m.createMany.mockRejectedValue(driftError("P2021"))
    expect((await recordEvents([purchase("cmorder000000000000000001")], ctx(false))).error).toBe("schema_unavailable")
  })

  it("any other failure is reported as write_failed, and the next chunk is still attempted", async () => {
    m.createMany.mockRejectedValueOnce(new Error("connection reset")).mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
    const many = Array.from({ length: 600 }, (_, i) => purchase(`cmorder${String(i).padStart(18, "0")}`))
    const r = await recordEvents(many, ctx(false))
    expect(r.error).toBe("write_failed")
    expect(r.written).toBe(100)
    expect(m.createMany).toHaveBeenCalledTimes(2)
  })

  it("garbage in a batch costs only the garbage — and never throws", async () => {
    const hostile = {
      get name(): string {
        throw new Error("boom")
      },
      eventId: "purchase:cmorder000000000000000009",
    }
    const garbage = [null, undefined, 3, "x", {}, { name: 5 }, { eventId: {}, name: {} }, hostile] as unknown as ServerEventInput[]
    const r = await recordEvents([...garbage, purchase("cmorder000000000000000001")], ctx(true))
    expect(r.written).toBe(1)
    expect(r.dropped.malformed).toBe(5) // null, undefined, 3, "x" (not objects) + the object whose getter throws
    expect(r.dropped.unknown_event).toBe(3) // {}, { name: 5 }, { name: {} }
    expect(r.error).toBeNull()
  })
})
