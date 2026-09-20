import sharp from "sharp"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { measureImageBuffer, measurePhoto } from "@/lib/photo-quality.server"
import { assessPhoto } from "@/lib/photo-quality"

const solid = (w: number, h: number, rgb: [number, number, number]) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).jpeg({ quality: 90 }).toBuffer()

async function checker(w: number, h: number) {
  // A busy pattern (quadrants of very different brightness) to exercise the hash and corner sampling.
  const half = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = (x < w / 2) !== (y < h / 2) ? 20 : 240
      const o = (y * w + x) * 3
      half[o] = half[o + 1] = half[o + 2] = v
    }
  return sharp(half, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer()
}

afterEach(() => vi.unstubAllGlobals())

describe("measureImageBuffer", () => {
  it("measures dimensions and a bright uniform background", async () => {
    const r = await measureImageBuffer(await solid(1200, 1200, [250, 250, 250]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.metrics.width).toBe(1200)
    expect(Math.min(...r.metrics.cornerLuma)).toBeGreaterThan(240)
    expect(assessPhoto(r.metrics, { isMain: true })).not.toContain("busy_background")
  })

  it("sees a dark main-photo background and a busy one", async () => {
    const dark = await measureImageBuffer(await solid(1200, 1200, [15, 15, 20]))
    expect(dark.ok && assessPhoto(dark.metrics, { isMain: true })).toContain("dark_background")
    const busy = await measureImageBuffer(await checker(1200, 1200))
    expect(busy.ok && assessPhoto(busy.metrics, { isMain: true })).toContain("busy_background")
  })

  it("produces stable hashes: same picture ≈ same hash, different picture ≠", async () => {
    const a = await measureImageBuffer(await checker(1200, 1200))
    const b = await measureImageBuffer(await checker(900, 900))
    const c = await measureImageBuffer(await solid(1200, 1200, [200, 30, 30]))
    if (!a.ok || !b.ok || !c.ok) throw new Error("measure failed")
    const { hammingHex } = await import("@/lib/photo-quality")
    expect(hammingHex(a.metrics.dHash, b.metrics.dHash)).toBeLessThanOrEqual(5)
    expect(a.metrics.dHash).not.toBe(c.metrics.dHash)
  })

  it("rejects non-images", async () => {
    expect(await measureImageBuffer(Buffer.from("definitely not an image"))).toEqual({ ok: false, reason: "not_image" })
  })
})

describe("measurePhoto — SSRF safety", () => {
  it("refuses private, loopback, metadata and non-https URLs without fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    for (const url of ["https://localhost/x.jpg", "https://127.0.0.1/x.jpg", "https://169.254.169.254/latest", "http://cdn.example.com/x.jpg", "https://user:pw@cdn.example.com/x.jpg"]) {
      expect(await measurePhoto(url)).toEqual({ ok: false, reason: "blocked" })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("re-validates every redirect hop", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://10.0.0.5/secret.jpg" } }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await measurePhoto("https://cdn.example.com/a.jpg")).toEqual({ ok: false, reason: "blocked" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("measures a downloaded image and a base64 data URL", async () => {
    const jpg = await solid(1000, 1000, [240, 240, 240])
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(jpg), { status: 200, headers: { "content-type": "image/jpeg" } })))
    const viaUrl = await measurePhoto("https://cdn.example.com/a.jpg")
    expect(viaUrl.ok && viaUrl.metrics.width).toBe(1000)
    const viaData = await measurePhoto(`data:image/jpeg;base64,${jpg.toString("base64")}`)
    expect(viaData.ok && viaData.metrics.height).toBe(1000)
  })
})
