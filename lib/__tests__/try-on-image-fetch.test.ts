import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ fetchPublic: vi.fn(), put: vi.fn() }))

vi.mock("@vercel/blob", () => ({ put: m.put }))
vi.mock("@/lib/safe-remote-image.server", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/safe-remote-image.server")>()),
  fetchPublicImageBytes: m.fetchPublic,
}))

import {
  fetchImageBytes,
  isVercelBlobUrl,
  mirrorExternalImageToTryOnBlob,
} from "@/lib/try-on/image-processing.server"

async function useRealGuard() {
  const actual = await vi.importActual<typeof import("@/lib/safe-remote-image.server")>(
    "@/lib/safe-remote-image.server"
  )
  m.fetchPublic.mockImplementation(actual.fetchPublicImageBytes)
}

beforeEach(() => {
  m.fetchPublic.mockReset()
  m.put.mockReset()
})

describe("fetchImageBytes", () => {
  it("goes through the SSRF-safe downloader with a size, time and redirect budget", async () => {
    m.fetchPublic.mockResolvedValue(Buffer.from("img"))

    const bytes = await fetchImageBytes("  https://replicate.delivery/out.png  ")

    expect(bytes.toString()).toBe("img")
    expect(m.fetchPublic).toHaveBeenCalledWith("https://replicate.delivery/out.png", {
      maxBytes: 10 * 1024 * 1024,
      timeoutMs: 12_000,
      maxRedirects: 3,
      allowHttp: true,
    })
  })

  const refused: Array<[string, string]> = [
    ["http://169.254.169.254/latest/meta-data/", "blocked_host"],
    ["http://localhost:3001/api/health", "blocked_host"],
    ["http://10.0.0.5/admin", "blocked_host"],
    ["https://[::ffff:127.0.0.1]/x", "blocked_address"],
    ["https://[fd00::1]/x", "blocked_address"],
  ]
  for (const [url, code] of refused) {
    it(`refuses ${url}`, async () => {
      await useRealGuard()
      await expect(fetchImageBytes(url)).rejects.toMatchObject({ code })
    })
  }
})

describe("isVercelBlobUrl", () => {
  it("accepts a real blob hostname", () => {
    expect(isVercelBlobUrl("https://abc123.public.blob.vercel-storage.com/try-on/x.webp")).toBe(true)
  })

  const notBlob = [
    "https://evil.example/?x=.blob.vercel-storage.com",
    "https://evil.example/.blob.vercel-storage.com/a.png",
    "https://blob.vercel-storage.com.evil.example/a.png",
    "http://abc.public.blob.vercel-storage.com/a.png",
    "not a url",
    "",
  ]
  for (const url of notBlob) {
    it(`rejects ${JSON.stringify(url)}`, () => expect(isVercelBlobUrl(url)).toBe(false))
  }
})

describe("mirrorExternalImageToTryOnBlob", () => {
  it("returns a real blob URL untouched, with no download", async () => {
    const url = "https://abc123.public.blob.vercel-storage.com/try-on/garments/a.webp"
    await expect(
      mirrorExternalImageToTryOnBlob({ sourceUrl: url, folder: "garments", keySuffix: "g" })
    ).resolves.toBe(url)
    expect(m.fetchPublic).not.toHaveBeenCalled()
  })

  it("no longer trusts a URL that merely CONTAINS the blob hostname", async () => {
    m.fetchPublic.mockRejectedValue(new Error("refused"))

    await expect(
      mirrorExternalImageToTryOnBlob({
        sourceUrl: "https://evil.example/?x=.blob.vercel-storage.com",
        folder: "garments",
        keySuffix: "g",
      })
    ).rejects.toThrow("refused")
    expect(m.fetchPublic).toHaveBeenCalledTimes(1)
    expect(m.put).not.toHaveBeenCalled()
  })

  it("never stores anything for an internal garment URL", async () => {
    await useRealGuard()

    await expect(
      mirrorExternalImageToTryOnBlob({
        sourceUrl: "http://169.254.169.254/latest/meta-data/",
        folder: "garments",
        keySuffix: "g",
      })
    ).rejects.toMatchObject({ code: "blocked_host" })
    expect(m.put).not.toHaveBeenCalled()
  })
})
