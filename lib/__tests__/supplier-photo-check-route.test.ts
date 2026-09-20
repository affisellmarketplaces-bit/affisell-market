import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.hoisted(() => vi.fn())
const measureMock = vi.hoisted(() => vi.fn())
vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: authMock }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: async () => null }))
vi.mock("@/lib/photo-quality.server", () => ({ measurePhoto: measureMock }))

import { POST } from "@/app/api/supplier/photo-check/route"

const metrics = (side: number, hash = "f0f0f0f0f0f0f0f0") => ({
  ok: true as const,
  metrics: { width: side, height: side, bytes: side * side, format: "jpeg", cornerLuma: [250, 250, 250, 250] as [number, number, number, number], dHash: hash },
})
const req = (body: unknown) => new Request("http://x/api/supplier/photo-check", { method: "POST", body: JSON.stringify(body) })

beforeEach(() => {
  authMock.mockReset()
  measureMock.mockReset()
})

describe("POST /api/supplier/photo-check", () => {
  it("requires a supplier session", async () => {
    authMock.mockResolvedValue(null)
    expect((await POST(req({ images: ["https://a/x.jpg"] }))).status).toBe(401)
    authMock.mockResolvedValue({ user: { id: "u", role: "AFFILIATE" } })
    expect((await POST(req({ images: ["https://a/x.jpg"] }))).status).toBe(403)
  })

  it("rejects an empty list and caps the batch at 8 images", async () => {
    authMock.mockResolvedValue({ user: { id: "u", role: "SUPPLIER" } })
    expect((await POST(req({ images: [] }))).status).toBe(400)
    measureMock.mockResolvedValue(metrics(1200))
    const res = await POST(req({ images: Array.from({ length: 12 }, (_, i) => `https://cdn.example/${i}.jpg`) }))
    expect((await res.json()).images).toHaveLength(8)
  })

  it("reports issues, and offers the original-resolution URL only when it is clearly bigger and loads", async () => {
    authMock.mockResolvedValue({ user: { id: "u", role: "SUPPLIER" } })
    measureMock.mockImplementation(async (url: string) =>
      url.includes("broken")
        ? { ok: false, reason: "fetch" }
        : url.endsWith("_640x640.jpg")
          ? metrics(640)
          : url.includes("big")
            ? metrics(1600)
            : metrics(1200, "0f0f0f0f0f0f0f0f")
    )
    const res = await POST(req({ images: ["https://ae.example/kf/big1.jpg_640x640.jpg", "https://ae.example/kf/broken.jpg_640x640.jpg"] }))
    const data = await res.json()
    expect(data.images[0].issues).toContain("low_res")
    expect(data.images[0].betterUrl).toBe("https://ae.example/kf/big1.jpg")
    expect(data.images[1].ok).toBe(false)
    expect(data.images[1].issues).toContain("unreadable")
    expect(data.gallery.issues).toContain("too_few")
  })
})
