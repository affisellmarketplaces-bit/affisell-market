import { beforeEach, describe, expect, it, vi } from "vitest"

/** The journal's two write routes: ADMIN only, same-site only, the signal is re-read by the server. */
const m = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), record: vi.fn(), measure: vi.fn() }))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/strategic-intelligence/collect.server", () => ({ loadIntelligenceCockpit: m.load }))
vi.mock("@/lib/strategic-intelligence/journal.server", () => ({ recordDecision: m.record, measureDecision: m.measure }))

const signal = { id: "market:category:fall:c1", domain: "market_observatory", kind: "fact", title: "Demande en baisse" }
const admin = { user: { id: "admin1", role: "ADMIN" }, expires: "2099-01-01" }

beforeEach(() => {
  m.auth.mockReset().mockResolvedValue(admin)
  m.load.mockReset().mockResolvedValue({ signals: [signal] })
  m.record.mockReset().mockResolvedValue({ ok: true, id: "d1", measurable: true })
  m.measure.mockReset().mockResolvedValue({ ok: true, outcomeId: "o1", verdict: "inconclusive", alreadyMeasured: false })
})

const post = (body: unknown, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }) =>
  new Request("http://localhost/api/admin/intelligence/decisions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
const valid = { signalId: signal.id, decision: "act", rationale: "Relancer la catégorie" }

describe("POST /api/admin/intelligence/decisions", () => {
  it.each([
    ["anonymous", null, 401],
    ["supplier", { user: { id: "s1", role: "SUPPLIER" } }, 403],
  ])("refuses %s, reads nothing, writes nothing", async (_l, session, status) => {
    m.auth.mockResolvedValue(session)
    const { POST } = await import("@/app/api/admin/intelligence/decisions/route")
    expect((await POST(post(valid))).status).toBe(status)
    expect(m.load).not.toHaveBeenCalled()
    expect(m.record).not.toHaveBeenCalled()
  })

  it("refuses a cross-site request", async () => {
    const { POST } = await import("@/app/api/admin/intelligence/decisions/route")
    const res = await POST(post(valid, { origin: "https://evil.example" }))
    expect(res.status).toBe(403)
    expect(m.record).not.toHaveBeenCalled()
  })

  it("records with the SERVER's signal (not the body's) and the admin as author", async () => {
    const { POST } = await import("@/app/api/admin/intelligence/decisions/route")
    const res = await POST(post({ ...valid, title: "forged", evidence: [{ label: "x", value: "y" }] }))
    expect(res.status).toBe(201)
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ signal, decision: "act", decidedById: "admin1", measureAfterDays: null }))
  })

  it("409 when the signal is no longer raised; 409 when a decision is already open; 400 on bad input", async () => {
    const { POST } = await import("@/app/api/admin/intelligence/decisions/route")
    m.load.mockResolvedValue({ signals: [] })
    expect((await POST(post(valid))).status).toBe(409)
    m.load.mockResolvedValue({ signals: [signal] })
    m.record.mockResolvedValue({ ok: false, error: "decision_already_open" })
    expect((await POST(post(valid))).status).toBe(409)
    expect((await POST(post({ ...valid, decision: "refund" }))).status).toBe(400)
    expect((await POST(post("{not json"))).status).toBe(400)
  })
})

describe("POST /api/admin/intelligence/decisions/:id/measure", () => {
  const req = () => new Request("http://localhost/x", { method: "POST", headers: { "sec-fetch-site": "same-origin" } })
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

  it("refuses a non-admin", async () => {
    m.auth.mockResolvedValue({ user: { id: "a1", role: "AFFILIATE" } })
    const { POST } = await import("@/app/api/admin/intelligence/decisions/[id]/measure/route")
    expect((await POST(req(), ctx("d1"))).status).toBe(403)
    expect(m.measure).not.toHaveBeenCalled()
  })

  it("measures as the admin; not due = 409; unknown = 404", async () => {
    const { POST } = await import("@/app/api/admin/intelligence/decisions/[id]/measure/route")
    expect((await POST(req(), ctx("d1"))).status).toBe(200)
    expect(m.measure).toHaveBeenCalledWith("d1", { measuredById: "admin1" })
    m.measure.mockResolvedValue({ ok: false, error: "not_due" })
    expect((await POST(req(), ctx("d1"))).status).toBe(409)
    m.measure.mockResolvedValue({ ok: false, error: "not_found" })
    expect((await POST(req(), ctx("d1"))).status).toBe(404)
  })
})
