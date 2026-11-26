import sharp from "sharp"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ findFirst: vi.fn(), fetchBytes: vi.fn() }))

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock("@/lib/prisma", () => ({ prisma: { affiliateProduct: { findFirst: m.findFirst } } }))
vi.mock("@/lib/marketplace-buyer-product-filter", () => ({ buyerListedAffiliateProductWhere: {} }))
vi.mock("@/lib/safe-remote-image.server", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/safe-remote-image.server")>()),
  fetchPublicImageBytes: m.fetchBytes,
}))

import { getListingCardImageWebp } from "@/lib/listing-card-image.server"
import { RemoteImageError } from "@/lib/safe-remote-image.server"

const URL_OK = "https://img.example.test/photo.png"

let png: Buffer
let jpeg: Buffer

function listingWith(customImages: string[]) {
  m.findFirst.mockResolvedValue({ customImages, product: { images: [] } })
}

function isWebp(buf: Buffer | null): boolean {
  return buf != null && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP"
}

beforeAll(async () => {
  const base = { create: { width: 64, height: 48, channels: 3 as const, background: "#3366cc" } }
  png = await sharp(base).png().toBuffer()
  jpeg = await sharp(base).jpeg().toBuffer()
})

beforeEach(() => {
  m.findFirst.mockReset()
  m.fetchBytes.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("getListingCardImageWebp", () => {
  it("renders a downloaded PNG as WebP, asking for a bounded download", async () => {
    listingWith([URL_OK])
    m.fetchBytes.mockResolvedValue(png)

    expect(isWebp(await getListingCardImageWebp("l1"))).toBe(true)
    expect(m.fetchBytes).toHaveBeenCalledWith(URL_OK, {
      maxBytes: 8 * 1024 * 1024,
      timeoutMs: 8_000,
      maxRedirects: 3,
      allowHttp: true,
    })
  })

  it("renders a JPEG too", async () => {
    listingWith([URL_OK])
    m.fetchBytes.mockResolvedValue(jpeg)
    expect(isWebp(await getListingCardImageWebp("l1"))).toBe(true)
  })

  it("falls back (null) instead of throwing when the download is refused", async () => {
    listingWith(["https://rebind.example.test/a.png"])
    m.fetchBytes.mockRejectedValue(new RemoteImageError("blocked_address", "169.254.169.254"))
    await expect(getListingCardImageWebp("l1")).resolves.toBeNull()
  })

  const refused: Array<[string, Buffer]> = [
    ["an SVG", Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')],
    ["an AVIF/HEIF container", Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from("ftypavif"), Buffer.alloc(32)])],
    ["a TIFF", Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(32)])],
    ["an HTML page", Buffer.from("<!doctype html><html><body>not an image</body></html>")],
    ["random bytes", Buffer.alloc(64, 7)],
  ]
  for (const [label, bytes] of refused) {
    it(`refuses ${label} even though it was downloaded fine`, async () => {
      listingWith([URL_OK])
      m.fetchBytes.mockResolvedValue(bytes)
      await expect(getListingCardImageWebp("l1")).resolves.toBeNull()
    })
  }

  it("refuses an image bigger than the pixel limit", async () => {
    // 8000 x 6000 = 48 Mpx, over the 40 Mpx limit; a flat colour keeps the file tiny
    const huge = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: "#fff" } })
      .png({ compressionLevel: 9 })
      .toBuffer()
    listingWith([URL_OK])
    m.fetchBytes.mockResolvedValue(huge)
    await expect(getListingCardImageWebp("l1")).resolves.toBeNull()
  }, 60_000)

  it("renders a data: PNG without any network call", async () => {
    listingWith([`data:image/png;base64,${png.toString("base64")}`])
    expect(isWebp(await getListingCardImageWebp("l1"))).toBe(true)
    expect(m.fetchBytes).not.toHaveBeenCalled()
  })

  it("refuses a data: SVG", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')
    listingWith([`data:image/svg+xml;base64,${svg.toString("base64")}`])
    await expect(getListingCardImageWebp("l1")).resolves.toBeNull()
  })

  it("refuses an oversized data: URL before decoding it", async () => {
    listingWith([`data:image/png;base64,${"A".repeat(12 * 1024 * 1024)}`])
    await expect(getListingCardImageWebp("l1")).resolves.toBeNull()
  })

  it("answers null for an unknown or unlisted listing and for an empty id", async () => {
    m.findFirst.mockResolvedValue(null)
    await expect(getListingCardImageWebp("ghost")).resolves.toBeNull()
    await expect(getListingCardImageWebp("  ")).resolves.toBeNull()
  })
})
