import { NextResponse } from "next/server"
import sharp from "sharp"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  groq: vi.fn(),
  search: vi.fn(),
  origin: vi.fn(),
  rateLimit: vi.fn(),
  rateLimitKey: vi.fn(),
}))

vi.mock("@/lib/ai/groq-client", () => ({ GROQ_VISION_MODEL: "vision-model", groqChatText: m.groq }))
vi.mock("@/lib/agent-catalog-search", () => ({ searchCatalogForAgent: m.search }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitClientKey: m.rateLimitKey,
  rateLimitResponseAsync: m.rateLimit,
}))
vi.mock("@/lib/request-origin-guard", () => ({ assertSameSiteRequestOrigin: m.origin }))

import { POST } from "@/app/api/agent/vision/route"
import {
  AGENT_VISION_MAX_BYTES,
  agentVisionImageFromBytes,
  agentVisionImageFromDataUrl,
} from "@/lib/agent-vision-input"

let png: Buffer
let jpeg: Buffer

beforeAll(async () => {
  const base = { create: { width: 32, height: 32, channels: 3 as const, background: "#cc3333" } }
  png = await sharp(base).png().toBuffer()
  jpeg = await sharp(base).jpeg().toBuffer()
})

describe("agent-vision-input", () => {
  it("takes the MIME type from the bytes, not from the caller", () => {
    expect(agentVisionImageFromBytes(jpeg)).toEqual({ ok: true, dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` })
    // a JPEG announced as a PNG comes out as a JPEG
    const lie = agentVisionImageFromDataUrl(`data:image/png;base64,${jpeg.toString("base64")}`)
    expect(lie).toEqual({ ok: true, dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` })
  })

  const notImages: Array<[string, Buffer]> = [
    ["an SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')],
    ["an HTML page", Buffer.from("<!doctype html><html><script>alert(1)</script></html>")],
    ["a PDF", Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64)])],
    ["random bytes", Buffer.alloc(64, 9)],
    ["too few bytes", Buffer.from([1, 2, 3])],
  ]
  for (const [label, bytes] of notImages) {
    it(`refuses ${label}, whatever it is labelled`, () => {
      expect(agentVisionImageFromBytes(bytes)).toMatchObject({ ok: false, status: 400 })
      expect(agentVisionImageFromDataUrl(`data:image/png;base64,${bytes.toString("base64")}`)).toMatchObject({
        ok: false,
        status: 400,
      })
    })
  }

  it("refuses an image over 4 MB with 413", () => {
    const big = Buffer.concat([png, Buffer.alloc(AGENT_VISION_MAX_BYTES)])
    expect(agentVisionImageFromBytes(big)).toMatchObject({ ok: false, status: 413 })
  })

  it("refuses a huge data URL on its length alone, before decoding it", () => {
    const decode = vi.spyOn(Buffer, "from")
    const res = agentVisionImageFromDataUrl(`data:image/png;base64,${"A".repeat(6_000_000)}`)

    expect(res).toMatchObject({ ok: false, status: 413 })
    expect(decode).not.toHaveBeenCalled()
    decode.mockRestore()
  })

  for (const raw of ["", "hello", "data:image/png,plain", "data:text/html;base64,PGh0bWw+", "data:image/png;base64,@@@"]) {
    it(`refuses the malformed data URL ${JSON.stringify(raw)}`, () => {
      expect(agentVisionImageFromDataUrl(raw)).toMatchObject({ ok: false, status: 400 })
    })
  }
})

describe("POST /api/agent/vision (public, paid)", () => {
  const url = "http://localhost/api/agent/vision"

  function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  }

  function multipartRequest(file: File): Request {
    const form = new FormData()
    form.set("image", file)
    return new Request(url, { method: "POST", body: form })
  }

  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset()
    vi.stubEnv("GROQ_API_KEY", "test-key")
    vi.stubEnv("OPENAI_API_KEY", "")
    m.origin.mockReturnValue(null)
    m.rateLimit.mockResolvedValue(null)
    m.rateLimitKey.mockReturnValue("ip:203.0.113.7")
    m.groq.mockResolvedValue("chaussures rouges, sport")
    m.search.mockResolvedValue({ products: [], similarProducts: [], suggestedCategories: [] })
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  const png64 = () => `data:image/png;base64,${png.toString("base64")}`

  it("answers 503 when no model key is configured", async () => {
    vi.stubEnv("GROQ_API_KEY", "")
    expect((await POST(jsonRequest({ image: png64() }))).status).toBe(503)
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("refuses a cross-site caller before spending anything", async () => {
    m.origin.mockReturnValue(NextResponse.json({ error: "origin_forbidden" }, { status: 403 }))
    const res = await POST(jsonRequest({ image: png64() }))

    expect(res.status).toBe(403)
    expect(m.rateLimit).not.toHaveBeenCalled()
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("is limited to 10 a minute per client, and stops there", async () => {
    m.rateLimit.mockResolvedValueOnce(NextResponse.json({ error: "rate_limit" }, { status: 429 }))
    const res = await POST(jsonRequest({ image: png64() }))

    expect(res.status).toBe(429)
    expect(m.rateLimit).toHaveBeenCalledTimes(1)
    expect(m.rateLimit).toHaveBeenCalledWith("ip:203.0.113.7", { limit: 10, windowMs: 60_000, prefix: "agent-vision" })
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("is also limited to 40 an hour per client", async () => {
    m.rateLimit
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(NextResponse.json({ error: "rate_limit" }, { status: 429 }))
    const res = await POST(jsonRequest({ image: png64() }))

    expect(res.status).toBe(429)
    expect(m.rateLimit).toHaveBeenNthCalledWith(2, "ip:203.0.113.7", {
      limit: 40,
      windowMs: 3_600_000,
      prefix: "agent-vision-hour",
    })
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("refuses an oversized request from its Content-Length, without parsing it", async () => {
    const res = await POST(jsonRequest({ image: png64() }, { "content-length": "9000000" }))

    expect(res.status).toBe(413)
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("searches by the image: the model receives a data URL typed from the bytes", async () => {
    const res = await POST(jsonRequest({ image: `data:image/png;base64,${jpeg.toString("base64")}` }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ keywords: "chaussures rouges, sport", searchQuery: "chaussures" })
    const content = m.groq.mock.calls[0]![0].messages[0].content as Array<{ image_url?: { url: string } }>
    expect(content[1]!.image_url!.url).toBe(`data:image/jpeg;base64,${jpeg.toString("base64")}`)
    expect(m.search).toHaveBeenCalledWith({}, "chaussures")
  })

  it("accepts a multipart photo", async () => {
    const res = await POST(multipartRequest(new File([new Uint8Array(png)], "photo.png", { type: "image/png" })))

    expect(res.status).toBe(200)
    expect(m.groq).toHaveBeenCalledTimes(1)
  })

  it("refuses an HTML page labelled image/png, in JSON and in multipart", async () => {
    const html = Buffer.from("<!doctype html><html><body>hi</body></html>")
    const viaJson = await POST(jsonRequest({ image: `data:image/png;base64,${html.toString("base64")}` }))
    const viaForm = await POST(multipartRequest(new File([new Uint8Array(html)], "x.png", { type: "image/png" })))

    expect(viaJson.status).toBe(400)
    expect(viaForm.status).toBe(400)
    expect(m.groq).not.toHaveBeenCalled()
  })

  it("answers 400 when there is no image at all", async () => {
    expect((await POST(jsonRequest({}))).status).toBe(400)
    expect((await POST(jsonRequest({ image: 42 }))).status).toBe(400)
    expect(m.groq).not.toHaveBeenCalled()
  })
})
