import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Finalisation master doc, C2: POST /api/import-1688 consumed the paid OneBound quota for anyone. It is now behind the
// supplier/admin guard (session + per-user rate limit).

const guardSupplierAiRoute = vi.fn()
const get1688 = vi.fn()

vi.mock("@/lib/ai-route-guards", () => ({ guardSupplierAiRoute: (...args: unknown[]) => guardSupplierAiRoute(...args) }))
vi.mock("@/lib/onebound", () => ({ get1688: (url: string) => get1688(url) }))

import { POST } from "@/app/api/import-1688/route"

function call(body: unknown) {
  return POST(new Request("http://localhost/api/import-1688", { method: "POST", body: JSON.stringify(body) }))
}

describe("POST /api/import-1688 guard", () => {
  beforeEach(() => {
    guardSupplierAiRoute.mockReset()
    get1688.mockReset()
  })

  it("refuses a caller without a supplier/admin session and never reaches the paid API", async () => {
    guardSupplierAiRoute.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) })
    const res = await call({ url: "https://detail.1688.com/offer/123.html" })
    expect(res.status).toBe(401)
    expect(get1688).not.toHaveBeenCalled()
  })

  it("refuses a rate-limited caller", async () => {
    guardSupplierAiRoute.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Too many requests" }, { status: 429 }) })
    const res = await call({ url: "https://detail.1688.com/offer/123.html" })
    expect(res.status).toBe(429)
    expect(get1688).not.toHaveBeenCalled()
  })

  it("uses its own rate-limit bucket", async () => {
    guardSupplierAiRoute.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) })
    await call({ url: "https://detail.1688.com/offer/123.html" })
    expect(guardSupplierAiRoute).toHaveBeenCalledWith(expect.any(Request), "import-1688")
  })

  it("lets an authorised supplier import", async () => {
    guardSupplierAiRoute.mockResolvedValue({ ok: true, userId: "sup_1" })
    get1688.mockResolvedValue({ source: "1688", name: "Produit", variants: [] })
    const res = await call({ url: "https://detail.1688.com/offer/123.html" })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
    expect(get1688).toHaveBeenCalledTimes(1)
  })

  it("still validates the body for an authorised caller", async () => {
    guardSupplierAiRoute.mockResolvedValue({ ok: true, userId: "sup_1" })
    const res = await call({})
    expect(res.status).toBe(400)
    expect(get1688).not.toHaveBeenCalled()
  })
})
