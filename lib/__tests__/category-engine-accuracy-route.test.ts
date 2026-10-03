import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ requireAdmin: vi.fn(), load: vi.fn() }))
vi.mock("@/lib/admin/require-admin-session", () => ({ requireAdminSession: m.requireAdmin }))
vi.mock("@/lib/category-engine-accuracy.server", () => ({ loadCategoryEngineReport: m.load }))

import { GET } from "@/app/api/admin/category-engine/accuracy/route"

beforeEach(() => {
  m.requireAdmin.mockReset()
  m.load.mockReset()
})

describe("GET /api/admin/category-engine/accuracy", () => {
  it("is admin-only", async () => {
    m.requireAdmin.mockResolvedValueOnce({ ok: false, status: 401, error: "unauthorized" })
    expect((await GET(new Request("http://x/api"))).status).toBe(401)
    m.requireAdmin.mockResolvedValueOnce({ ok: false, status: 403, error: "forbidden" })
    expect((await GET(new Request("http://x/api"))).status).toBe(403)
    expect(m.load).not.toHaveBeenCalled()
  })

  it("passes the window and a capped corrections limit through", async () => {
    m.requireAdmin.mockResolvedValue({ ok: true, session: {} })
    m.load.mockResolvedValue({ agreementRate: 0.9 })
    const res = await GET(new Request("http://x/api?days=30&corrections=9999"))
    expect(await res.json()).toEqual({ agreementRate: 0.9 })
    expect(m.load).toHaveBeenCalledWith({ windowDays: 30, correctionsLimit: 500 })

    await GET(new Request("http://x/api"))
    expect(m.load).toHaveBeenLastCalledWith({ windowDays: 90, correctionsLimit: 100 })
    await GET(new Request("http://x/api?days=abc&corrections=-3"))
    expect(m.load).toHaveBeenLastCalledWith({ windowDays: 90, correctionsLimit: 100 })
    await GET(new Request("http://x/api?corrections=0"))
    expect(m.load).toHaveBeenLastCalledWith({ windowDays: 90, correctionsLimit: 0 })
  })
})
