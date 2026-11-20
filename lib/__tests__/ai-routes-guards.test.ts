import { NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

const m = vi.hoisted(() => ({
  guard: vi.fn(),
  groq: vi.fn(),
  categoryFindMany: vi.fn(),
  productFindMany: vi.fn(),
  productUpdate: vi.fn(),
  admin: vi.fn(),
  rateLimit: vi.fn(),
  rateLimitKey: vi.fn(),
  origin: vi.fn(),
}))

vi.mock("@/lib/ai-route-guards", () => ({ guardSupplierAiRoute: m.guard }))
vi.mock("@/lib/ai/groq-client", () => ({ groqChatText: m.groq }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findMany: m.categoryFindMany },
    product: { findMany: m.productFindMany, update: m.productUpdate },
  },
}))
vi.mock("@/lib/admin/require-admin-session", () => ({ requireAdminSession: m.admin }))
vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitClientKey: m.rateLimitKey,
  rateLimitResponseAsync: m.rateLimit,
}))
vi.mock("@/lib/request-origin-guard", () => ({ assertSameSiteRequestOrigin: m.origin }))

import { POST as fillSpecsPOST } from "@/app/api/ai/fill-specs/route"
import { POST as suggestSpecsPOST } from "@/app/api/ai/suggest-specs/route"
import { POST as translatePOST } from "@/app/api/products/translate/route"
import { POST as inpaintPOST } from "@/app/api/inpaint/route"

function post(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const REFUSED_401 = () => ({ ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) })
const ALLOWED = { ok: true, userId: "sup_1" }

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.guard.mockResolvedValue(ALLOWED)
  m.categoryFindMany.mockResolvedValue([{ id: "c1", name: "Shirts", attributes: [{ key: "color", label: "Color" }] }])
  m.rateLimit.mockResolvedValue(null)
  m.rateLimitKey.mockImplementation((_req: Request, userId?: string | null) => `user:${userId}`)
  m.origin.mockReturnValue(null)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe.each([
  ["POST /api/ai/fill-specs", fillSpecsPOST, "ai-fill-specs"],
  ["POST /api/ai/suggest-specs", suggestSpecsPOST, "ai-suggest-specs"],
] as const)("%s", (_name, POST, prefix) => {
  const call = (body: unknown) => POST(post("/api/ai/specs", body) as never)

  it("is reserved to suppliers/admins: a refused guard stops everything before the model or the database", async () => {
    m.guard.mockResolvedValue(REFUSED_401())
    const res = await call({ productTitle: "Shirt" })

    expect(res.status).toBe(401)
    expect(m.guard).toHaveBeenCalledWith(expect.any(Request), prefix)
    expect(m.groq).not.toHaveBeenCalled()
    expect(m.categoryFindMany).not.toHaveBeenCalled()
  })

  it("answers 400 without calling the model when there is nothing to analyse", async () => {
    expect((await call({})).status).toBe(400)
    expect((await call("{not json")).status).toBe(400)
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("refuses an image that is not https or a data image, before the (paid) model sees it", async () => {
    const res = await call({ productTitle: "Shirt", imageUrl: "http://169.254.169.254/latest/meta-data/" })

    expect(res.status).toBe(400)
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("analyses a valid title", async () => {
    m.groq.mockResolvedValue(JSON.stringify({ categoryId: "c1", specs: { color: "red" } }))
    const res = await call({ productTitle: "Red shirt" })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ categoryId: "c1", categoryName: "Shirts", specs: { color: "red" } })
    expect(m.groq).toHaveBeenCalledTimes(1)
  })

  it("answers a clean 500 when the model returns something that is not JSON", async () => {
    m.groq.mockResolvedValue("sorry, I cannot")
    const res = await call({ productTitle: "Red shirt" })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "AI failed" })
  })
})

describe("POST /api/products/translate (rewrites production data)", () => {
  const call = () => translatePOST(post("/api/products/translate", {}))
  const ADMIN = { ok: true, session: { user: { id: "admin_1" } } }

  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-key")
    m.admin.mockResolvedValue(ADMIN)
    m.productFindMany.mockResolvedValue([
      { id: "p1", name: "Chemise femme", description: "Livraison en France métropolitaine" },
      { id: "p2", name: "Plain shirt", description: "A shirt" },
    ])
    m.groq.mockResolvedValue("Translated")
  })

  it("refuses a visitor: nothing is read, nothing is rewritten", async () => {
    m.admin.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" })
    const res = await call()

    expect(res.status).toBe(401)
    expect(m.productFindMany).not.toHaveBeenCalled()
    expect(m.groq).not.toHaveBeenCalled()
    expect(m.productUpdate).not.toHaveBeenCalled()
  })

  it("refuses a signed-in non-admin", async () => {
    m.admin.mockResolvedValue({ ok: false, status: 403, error: "forbidden" })
    const res = await call()

    expect(res.status).toBe(403)
    expect(m.productUpdate).not.toHaveBeenCalled()
  })

  it("refuses a cross-site request even from an admin's browser (CSRF)", async () => {
    m.origin.mockReturnValue(NextResponse.json({ error: "origin_forbidden" }, { status: 403 }))
    const res = await call()

    expect(res.status).toBe(403)
    expect(m.admin).not.toHaveBeenCalled()
    expect(m.productUpdate).not.toHaveBeenCalled()
  })

  it("is limited to 2 runs an hour per admin", async () => {
    m.rateLimit.mockResolvedValue(NextResponse.json({ error: "rate_limit" }, { status: 429 }))
    const res = await call()

    expect(res.status).toBe(429)
    expect(m.rateLimitKey.mock.calls[0]![1]).toBe("admin_1")
    expect(m.rateLimit).toHaveBeenCalledWith("user:admin_1", { limit: 2, windowMs: 3_600_000, prefix: "products-translate" })
    expect(m.productFindMany).not.toHaveBeenCalled()
  })

  it("still does its job for an admin: only the non-English product is rewritten", async () => {
    const res = await call()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, scanned: 2, updated: 1 })
    expect(m.productUpdate).toHaveBeenCalledTimes(1)
    expect(m.productUpdate.mock.calls[0]![0].where).toEqual({ id: "p1" })
  })
})

describe("POST /api/inpaint (paid Hugging Face inference)", () => {
  let fetchSpy: MockInstance<typeof fetch>
  const B64 = "iVBORw0KGgo="
  const call = (body: unknown) => inpaintPOST(post("/api/inpaint", body) as never)

  beforeEach(() => {
    vi.stubEnv("HUGGINGFACE_API_KEY", "hf-test")
    fetchSpy = vi.spyOn(globalThis, "fetch")
  })

  it("is reserved to suppliers/admins and never reaches the provider otherwise", async () => {
    m.guard.mockResolvedValue(REFUSED_401())
    const res = await call({ image: B64, mask: B64 })

    expect(res.status).toBe(401)
    expect(m.guard).toHaveBeenCalledWith(expect.any(Request), "inpaint")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("needs an image and a mask", async () => {
    expect((await call({ image: B64 })).status).toBe(400)
    expect((await call({})).status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("refuses an oversized image or mask with 413", async () => {
    const res = await call({ image: "A".repeat(8_000_001), mask: B64 })

    expect(res.status).toBe(413)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("refuses a payload that is not base64", async () => {
    const res = await call({ image: "data:image/png;base64,<script>", mask: B64 })

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("clips the prompt to 300 characters before it is sent to the provider", async () => {
    fetchSpy.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } }))
    const res = await call({ image: B64, mask: B64, prompt: "x".repeat(5000) })

    expect(res.status).toBe(200)
    const sent = JSON.parse(String(fetchSpy.mock.calls[0]![1]!.body)) as { inputs: { prompt: string } }
    expect(sent.inputs.prompt).toHaveLength(300)
  })

  it("does not hand the provider's error details to the client in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    fetchSpy.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "model token=hf_secret quota exceeded" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
    )
    const res = await call({ image: B64, mask: B64 })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: "Hugging Face inpaint failed on primary + fallback models" })
    expect(JSON.stringify(body)).not.toContain("hf_secret")
  })
})
