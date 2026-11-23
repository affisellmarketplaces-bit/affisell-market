/**
 * Conversion events — technical preparation after the founder's decisions of 2026-11-23 (D1 legacy tracking respects
 * consent, D2 no cookie-free counter, D3 90 days raw then aggregates with a verifiable purge, D4 aggregated only).
 * Nothing here is wired or switched on: these tests pin that it stays inert by default.
 */
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  record: vi.fn(async (inputs: unknown[]) => ({ received: inputs.length, written: inputs.length, duplicates: 0, dropped: {}, error: null })),
  trackCreate: vi.fn(async () => ({})),
  postUpdate: vi.fn(async () => ({})),
  user: { id: "u1", role: "CUSTOMER" } as { id: string; role: string },
}))

vi.mock("@/lib/events/record.server", () => ({ recordEvents: m.record }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "ip", rateLimitResponseAsync: vi.fn(async () => null) }))
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: m.user })) }))
vi.mock("@/lib/prisma", () => ({ prisma: { affisellTrackEvent: { create: m.trackCreate }, communityPost: { update: m.postUpdate } } }))

import { aggregateDailyListingEvents, ordersPer100MeasuredViews, planEventPurge, publishableUniqueViews, type RawEventRow } from "@/lib/events/aggregate"
import { analyticsConsentFromCookieHeader, legacyTrackingUserId, readAnalyticsConsent } from "@/lib/events/consent"
import { isLikelyBotUserAgent, readConversionEventsMode, toServerEventInput } from "@/lib/events/ingest"
import { readEventsPurgeMode, runEventPurge, type PurgeDeps } from "@/lib/events/purge"

const prefs = (o: unknown) => `affisell_cookie_prefs=${encodeURIComponent(JSON.stringify(o))}`
const GRANTED = prefs({ essential: true, analytics: true, marketing: false, updatedAt: "2026-11-23T00:00:00Z" })
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15"
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

describe("server-side consent reading (fails closed)", () => {
  it("reads the granular cookie, strictly", () => {
    expect(readAnalyticsConsent(null)).toBe("absent")
    expect(readAnalyticsConsent(GRANTED)).toBe("granted")
    expect(readAnalyticsConsent(prefs({ analytics: false }))).toBe("denied")
    expect(readAnalyticsConsent(prefs({ analytics: "false" }))).toBe("denied")
    expect(readAnalyticsConsent(prefs({ analytics: 1 }))).toBe("denied")
  })
  it("an unreadable granular cookie is no consent, even beside an old 'accept all' banner", () => {
    const h = "affisell_cookie_prefs=%7Bnot-json; affisell_cookie_consent=true"
    expect(readAnalyticsConsent(h)).toBe("unreadable")
    expect(analyticsConsentFromCookieHeader(h)).toBe(false)
  })
  it("the legacy banner cookie counts only when the granular one is absent", () => {
    expect(analyticsConsentFromCookieHeader("affisell_cookie_consent=true")).toBe(true)
    expect(analyticsConsentFromCookieHeader("affisell_cookie_consent=false")).toBe(false)
    expect(analyticsConsentFromCookieHeader(`${prefs({ analytics: false })}; affisell_cookie_consent=true`)).toBe(false)
    expect(analyticsConsentFromCookieHeader("other=1")).toBe(false)
  })
})

describe("ingestion decisions", () => {
  it("is off unless the switch says exactly 'on'", () => {
    expect(readConversionEventsMode({})).toBe("off")
    expect(readConversionEventsMode({ CONVERSION_EVENTS_MODE: "ON" })).toBe("off")
    expect(readConversionEventsMode({ CONVERSION_EVENTS_MODE: "true" })).toBe("off")
    expect(readConversionEventsMode({ CONVERSION_EVENTS_MODE: "on" })).toBe("on")
  })
  it("never counts robots or tools", () => {
    for (const ua of [null, "", "curl/8.4", "Googlebot/2.1", "Mozilla/5.0 HeadlessChrome", "python-requests/2.31", "Chrome-Lighthouse"]) {
      expect(isLikelyBotUserAgent(ua)).toBe(true)
    }
    expect(isLikelyBotUserAgent(UA)).toBe(false)
  })
  it("a browser event never carries an account id nor a durable visitor id (D4)", () => {
    const input = toServerEventInput({ eventId: uuid(1), name: "product_view", sessionId: uuid(9), listingId: "l1" })
    expect(input.userId).toBeNull()
    expect(input.anonymousId).toBeNull()
    expect(input.sessionId).toBe(uuid(9))
  })
})

describe("POST /api/events", () => {
  beforeEach(() => {
    m.record.mockClear()
    delete process.env.CONVERSION_EVENTS_MODE
  })
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", "user-agent": UA, cookie: GRANTED, ...headers },
      body: JSON.stringify(body),
    })
  const batch = { events: [{ eventId: uuid(1), name: "product_view", listingId: "listing-1", sessionId: uuid(7) }] }

  it("switched off by default: answers without reading the body and stores nothing", async () => {
    const { POST } = await import("@/app/api/events/route")
    const r = req(batch)
    const res = await POST(r)
    expect(res.status).toBe(204)
    expect(res.headers.get("X-Affisell-Events")).toBe("off")
    expect(r.bodyUsed).toBe(false)
    expect(m.record).not.toHaveBeenCalled()
  })
  it("switched on: no consent = nothing parsed, nothing stored", async () => {
    process.env.CONVERSION_EVENTS_MODE = "on"
    const { POST } = await import("@/app/api/events/route")
    const r = req(batch, { cookie: prefs({ analytics: false }) })
    const res = await POST(r)
    expect(res.headers.get("X-Affisell-Events")).toBe("no_consent")
    expect(r.bodyUsed).toBe(false)
    expect(m.record).not.toHaveBeenCalled()
  })
  it("switched on: robots and cross-site calls are refused", async () => {
    process.env.CONVERSION_EVENTS_MODE = "on"
    const { POST } = await import("@/app/api/events/route")
    expect((await POST(req(batch, { "user-agent": "curl/8.4" }))).headers.get("X-Affisell-Events")).toBe("robot")
    expect((await POST(req(batch, { "sec-fetch-site": "cross-site", origin: "https://evil.example" }))).status).toBe(403)
    expect(m.record).not.toHaveBeenCalled()
  })
  it("switched on with consent: records without any account or visitor id", async () => {
    process.env.CONVERSION_EVENTS_MODE = "on"
    const { POST } = await import("@/app/api/events/route")
    const res = await POST(req(batch))
    expect(res.status).toBe(204)
    expect(m.record).toHaveBeenCalledTimes(1)
    const [inputs, ctx] = m.record.mock.calls[0] as unknown as [Array<Record<string, unknown>>, { analyticsConsent: boolean }]
    expect(ctx.analyticsConsent).toBe(true)
    expect(inputs[0]).toMatchObject({ name: "product_view", listingId: "listing-1", userId: null, anonymousId: null })
  })
  it("refuses an envelope that is not a batch", async () => {
    process.env.CONVERSION_EVENTS_MODE = "on"
    const { POST } = await import("@/app/api/events/route")
    expect((await POST(req({ events: [] }))).status).toBe(400)
  })
})

describe("legacy tracking respects consent (D1)", () => {
  beforeEach(() => {
    m.trackCreate.mockClear()
    m.postUpdate.mockClear()
  })
  const post = (url: string, body: unknown, cookie?: string) =>
    new Request(url, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })

  it("/api/track writes nothing without consent, and writes with it", async () => {
    const { POST } = await import("@/app/api/track/route")
    await POST(post("http://localhost/api/track", { type: "view", productId: "p1", sessionId: "s-12345678" }))
    expect(m.trackCreate).not.toHaveBeenCalled()
    await POST(post("http://localhost/api/track", { type: "view", productId: "p1", sessionId: "s-12345678" }, GRANTED))
    expect(m.trackCreate).toHaveBeenCalledTimes(1)
  })
  it("an account id is kept only for a reseller (its only readers count resellers); never for a buyer", async () => {
    expect(legacyTrackingUserId({ id: "r1", role: "AFFILIATE" })).toBe("r1")
    expect(legacyTrackingUserId({ id: "b1", role: "CUSTOMER" })).toBeNull()
    expect(legacyTrackingUserId({ id: "s1", role: "SUPPLIER" })).toBeNull()
    expect(legacyTrackingUserId(null)).toBeNull()
    const { POST } = await import("@/app/api/track/route")
    m.user = { id: "b1", role: "CUSTOMER" }
    await POST(post("http://localhost/api/track", { type: "view", productId: "p1", sessionId: "s-12345678" }, GRANTED))
    expect((m.trackCreate.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data).toMatchObject({ userId: undefined, sessionId: "s-12345678" })
    m.user = { id: "r1", role: "AFFILIATE" }
    await POST(post("http://localhost/api/track", { type: "view", productId: "p1", sessionId: "s-12345678" }, GRANTED))
    expect((m.trackCreate.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data).toMatchObject({ userId: "r1", sessionId: undefined })
  })
  it("/api/pulse/view keeps the anonymous post counter but writes no identified row without consent", async () => {
    const { POST } = await import("@/app/api/pulse/view/route")
    await POST(post("http://localhost/api/pulse/view", { source: "community", id: "c1", productId: "p1" }))
    expect(m.postUpdate).toHaveBeenCalledTimes(1)
    expect(m.trackCreate).not.toHaveBeenCalled()
    await POST(post("http://localhost/api/pulse/view", { source: "community", id: "c1", productId: "p1" }, GRANTED))
    expect(m.trackCreate).toHaveBeenCalledTimes(1)
  })
  it("the agent checkout writes its legacy row only when told consent was given, and its route reads the cookie", () => {
    const lib = readFileSync(join(process.cwd(), "lib/agent-checkout.ts"), "utf8")
    expect(lib).toMatch(/if \(opts\.analyticsConsent === true\) \{\s*await prisma\.affisellTrackEvent\.create\(\{\s*data: \{\s*eventType: "checkout_initiated",\s*productId: listing\.productId,\s*\},/)
    const route = readFileSync(join(process.cwd(), "app/api/agent/route.ts"), "utf8")
    expect(route).toContain('analyticsConsent: analyticsConsentFromCookieHeader(req.headers.get("cookie"))')
  })
  it("the browser helper sends nothing without consent", () => {
    const src = readFileSync(join(process.cwd(), "lib/affisell-track-client.ts"), "utf8")
    expect(src.indexOf("if (!hasAnalyticsConsent()) return")).toBeLessThan(src.indexOf("getOrCreateAgentSessionId()\n"))
  })
  it("no page wires the new browser client yet (S4 needs the founder's go)", () => {
    const hits = execSync("grep -rl 'lib/events/client' app components hooks lib --include=*.ts --include=*.tsx || true", { encoding: "utf8" })
      .split("\n")
      .filter((f) => f && !f.includes("__tests__"))
    expect(hits).toEqual([])
  })
})

describe("daily aggregates (D4) and publication floors", () => {
  const at = (iso: string) => new Date(iso)
  const row = (over: Partial<RawEventRow>): RawEventRow => ({ eventType: "product_view", listingId: "l1", sessionId: "s1", at: at("2026-11-20T10:00:00Z"), ...over })

  it("counts a view once per session × listing × 30 minutes; unique views = distinct sessions", () => {
    const r = aggregateDailyListingEvents(
      [row({}), row({ at: at("2026-11-20T10:10:00Z") }), row({ at: at("2026-11-20T10:45:00Z") }), row({ sessionId: "s2" }), row({ eventType: "add_to_cart" })],
      new Set(["l1"]),
    )
    expect(r.aggregates).toEqual([{ day: "2026-11-20", listingId: "l1", views: 3, uniqueViews: 2, addToCart: 1, removeFromCart: 0, checkoutsStarted: 0 }])
  })
  it("sets apart unknown listings, events without a listing and bursting sessions", () => {
    const burst = Array.from({ length: 301 }, (_, i) => row({ sessionId: "bot", at: new Date(Date.UTC(2026, 10, 20, 0, 0, i)) }))
    const r = aggregateDailyListingEvents([...burst, row({ listingId: "ghost" }), row({ listingId: null })], new Set(["l1"]))
    expect(r.aggregates).toEqual([])
    expect(r).toMatchObject({ unknownListing: 1, noListing: 1, excludedSessions: 1, excludedEvents: 301 })
  })
  it("never publishes a figure that could single a person out, nor a ratio on too few views", () => {
    expect(publishableUniqueViews(4)).toBeNull()
    expect(publishableUniqueViews(5)).toBe(5)
    expect(ordersPer100MeasuredViews(3, 99)).toBeNull()
    expect(ordersPer100MeasuredViews(3, 200)).toBe(1.5)
  })
})

describe("90-day purge (D3): never without aggregates, verifiable", () => {
  const now = new Date("2026-11-23T12:00:00Z")
  it("only days past retention AND aggregated are purgeable; the others are blocked", () => {
    const plan = planEventPurge({ now, rawDays: ["2026-08-20", "2026-08-24", "2026-08-25", "2026-11-01"], aggregatedDays: new Set(["2026-08-20"]) })
    expect(plan.cutoff.toISOString()).toBe("2026-08-25T00:00:00.000Z")
    expect(plan.purgeable).toEqual(["2026-08-20"])
    expect(plan.blocked).toEqual(["2026-08-24"])
  })
  const fakeDb = (aggregated: string[], opts: { leak?: boolean } = {}) => {
    const rows = new Map<string, number>([["2026-08-01", 40], ["2026-08-02", 10], ["2026-11-20", 99]])
    const proofs: unknown[] = []
    const deps: PurgeDeps = {
      listRawDays: async () => [...rows.keys()],
      loadAggregatedDays: async () => new Set(aggregated),
      countDay: async (d) => rows.get(d) ?? 0,
      deleteDay: async (d) => {
        const n = rows.get(d) ?? 0
        rows.set(d, opts.leak ? 1 : 0)
        return opts.leak ? n - 1 : n
      },
      recordProof: async (p) => void proofs.push(p),
    }
    return { deps, rows, proofs }
  }
  it("off by default; without stored aggregates nothing can ever be deleted", async () => {
    expect(readEventsPurgeMode({})).toBe("off")
    const db = fakeDb([])
    expect((await runEventPurge(db.deps, { mode: "off", now })).proofs).toEqual([])
    const r = await runEventPurge(db.deps, { mode: "enforce", now })
    expect(r.blocked).toEqual(["2026-08-01", "2026-08-02"])
    expect(r.proofs).toEqual([])
    expect(db.rows.get("2026-08-01")).toBe(40)
  })
  it("observe counts and deletes nothing; enforce deletes, recounts and proves", async () => {
    const db = fakeDb(["2026-08-01", "2026-08-02"])
    expect((await runEventPurge(db.deps, { mode: "observe", now })).wouldDelete).toEqual([{ day: "2026-08-01", rows: 40 }, { day: "2026-08-02", rows: 10 }])
    expect(db.rows.get("2026-08-01")).toBe(40)
    const r = await runEventPurge(db.deps, { mode: "enforce", now })
    expect(r.proofs.every((p) => p.verified)).toBe(true)
    expect(db.proofs).toHaveLength(2)
    expect(db.rows.get("2026-11-20")).toBe(99)
  })
  it("a day with rows left after deletion is unverified and stops the run", async () => {
    const db = fakeDb(["2026-08-01", "2026-08-02"], { leak: true })
    const r = await runEventPurge(db.deps, { mode: "enforce", now })
    expect(r.stoppedOnUnverified).toBe("2026-08-01")
    expect(r.proofs).toHaveLength(1)
  })
})
