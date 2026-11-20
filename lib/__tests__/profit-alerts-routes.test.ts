import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  updateMany: vi.fn(),
  loadAlerts: vi.fn(),
  loadPref: vi.fn(),
  savePref: vi.fn(),
  runAll: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: async () => null }))
vi.mock("@/lib/prisma", () => ({ prisma: { resellerProfitAlert: { updateMany: m.updateMany } } }))
vi.mock("@/lib/intelligence/profit-alerts.server", () => ({
  loadResellerAlerts: m.loadAlerts,
  loadAlertPreference: m.loadPref,
  saveAlertPreference: m.savePref,
  runProfitAlertsForAllResellers: m.runAll,
}))
vi.mock("@/lib/cron/authorize-cron-request", () => ({
  authorizeCronRequest: (req: Request) =>
    req.headers.get("authorization") === "Bearer ok" ? null : new Response("unauthorized", { status: 401 }),
}))

import { GET as prefGET, PUT as prefPUT } from "@/app/api/affiliate/alert-preferences/route"
import { POST as dismiss } from "@/app/api/affiliate/profit-alerts/[id]/dismiss/route"
import { GET as listGET } from "@/app/api/affiliate/profit-alerts/route"
import { GET as cronGET } from "@/app/api/cron/reseller-profit-alerts/route"

const me = { user: { id: "aff_me", role: "AFFILIATE" } }
const put = (body: unknown) => prefPUT(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }))

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.auth.mockResolvedValue(me)
})

describe("profit-alert routes", () => {
  it("list: only the caller's own alerts; other roles refused", async () => {
    m.loadAlerts.mockResolvedValue([])
    expect((await listGET(new Request("http://x?affiliateId=other"))).status).toBe(200)
    expect(m.loadAlerts).toHaveBeenCalledWith("aff_me")
    m.auth.mockResolvedValueOnce({ user: { id: "s", role: "SUPPLIER" } })
    expect((await listGET(new Request("http://x"))).status).toBe(403)
    m.auth.mockResolvedValueOnce(null)
    expect((await listGET(new Request("http://x"))).status).toBe(401)
  })

  it("dismiss: scoped to the caller; someone else's alert answers 404", async () => {
    m.updateMany.mockResolvedValueOnce({ count: 0 })
    const res = await dismiss(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "al_other" }) })
    expect(res.status).toBe(404)
    expect(m.updateMany.mock.calls[0]![0].where).toEqual({ id: "al_other", affiliateId: "aff_me", dismissedAt: null })
  })

  it("preferences: strict body, saved for the caller only", async () => {
    expect((await put({ inApp: true, email: "yes", locale: "fr" })).status).toBe(400)
    expect((await put({ inApp: true, email: true, locale: "xx" })).status).toBe(400)
    m.savePref.mockResolvedValue({ inApp: true, email: true, locale: "de" })
    expect((await put({ inApp: true, email: true, locale: "de", affiliateId: "other" })).status).toBe(200)
    expect(m.savePref).toHaveBeenCalledWith("aff_me", { inApp: true, email: true, locale: "de" })
    m.loadPref.mockResolvedValue({ inApp: true, email: false, locale: "fr", saved: false })
    expect(await (await prefGET()).json()).toMatchObject({ email: false })
    expect(m.loadPref).toHaveBeenCalledWith("aff_me")
  })

  it("cron: secret required; 500 when a reseller failed", async () => {
    expect((await cronGET(new Request("http://x"))).status).toBe(401)
    m.runAll.mockResolvedValueOnce({ resellers: 2, created: 1, cooldown: 0, duplicates: 0, failed: 0, notMigrated: false })
    expect((await cronGET(new Request("http://x", { headers: { authorization: "Bearer ok" } }))).status).toBe(200)
    m.runAll.mockResolvedValueOnce({ resellers: 2, created: 0, cooldown: 0, duplicates: 0, failed: 1, notMigrated: false })
    expect((await cronGET(new Request("http://x", { headers: { authorization: "Bearer ok" } }))).status).toBe(500)
  })
})
