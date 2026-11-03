import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  fetchPublic: vi.fn(),
}))

vi.mock("fs/promises", () => ({
  default: { readFile: m.readFile, mkdir: m.mkdir, writeFile: m.writeFile },
}))
vi.mock("@/lib/safe-remote-image.server", () => ({ fetchPublicImageBytes: m.fetchPublic }))
vi.mock("@/lib/site-url", () => ({ getAbsoluteUrl: (p: string) => `https://shop.example.test${p}` }))

import sharp from "sharp"

import { generateCategoryCard } from "@/lib/merchandise/generate-card"

const TEMPLATE = { bg: "#ffffff", shape: "circle", textColor: "#000000" } as const
const PUBLIC_DIR = path.join(process.cwd(), "public")
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])

let photo: Buffer

function isPng(buf: Buffer): boolean {
  return buf.subarray(0, 4).equals(PNG_SIGNATURE)
}

beforeEach(async () => {
  for (const fn of Object.values(m)) fn.mockReset()
  photo ??= await sharp({ create: { width: 64, height: 64, channels: 3, background: "#3366cc" } }).png().toBuffer()
  // default: nothing cached, and only public/uploads/a.png exists on disk
  m.readFile.mockImplementation(async (file: string) => {
    if (String(file).endsWith(`${path.sep}public${path.sep}uploads${path.sep}a.png`)) return photo
    throw new Error("ENOENT")
  })
  m.mkdir.mockResolvedValue(undefined)
  m.writeFile.mockResolvedValue(undefined)
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
})

describe("generateCategoryCard — product photo handling", () => {
  it("downloads a remote photo through the SSRF-safe downloader, with a budget", async () => {
    m.fetchPublic.mockResolvedValue(photo)

    const card = await generateCategoryCard({ id: "prod1", images: ["https://cdn.example.test/p.png"] }, "Shoes", TEMPLATE)

    expect(isPng(card)).toBe(true)
    expect(m.fetchPublic).toHaveBeenCalledWith("https://cdn.example.test/p.png", {
      maxBytes: 8 * 1024 * 1024,
      timeoutMs: 8_000,
      maxRedirects: 3,
      allowHttp: true,
    })
    expect(m.writeFile).toHaveBeenCalledWith(path.join(PUBLIC_DIR, "generated", "categories", "prod1.png"), card)
  })

  it("still makes a card (white tile) when the download is refused", async () => {
    m.fetchPublic.mockRejectedValue(new Error("remote_image_blocked_address: 169.254.169.254"))

    const card = await generateCategoryCard({ id: "prod2", images: ["http://rebind.example.test/p.png"] }, "Shoes", TEMPLATE)

    expect(isPng(card)).toBe(true)
  })

  it("never decodes something that is not a plain image: an SVG gives exactly the white-tile card", async () => {
    m.fetchPublic.mockRejectedValueOnce(new Error("refused"))
    const whiteTileCard = await generateCategoryCard({ id: "prod3a", images: ["https://cdn.example.test/x.png"] }, "Shoes", TEMPLATE)

    // a decodable SVG would render (transparent 400x400) and give a different card
    m.fetchPublic.mockResolvedValueOnce(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>'))
    const svgCard = await generateCategoryCard({ id: "prod3b", images: ["https://cdn.example.test/p.svg"] }, "Shoes", TEMPLATE)

    expect(isPng(svgCard)).toBe(true)
    expect(svgCard.equals(whiteTileCard)).toBe(true)
  })

  it("makes a card even when the photo is corrupt", async () => {
    m.fetchPublic.mockResolvedValue(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]))

    const card = await generateCategoryCard({ id: "prod4", images: ["https://cdn.example.test/p.png"] }, "Shoes", TEMPLATE)

    expect(isPng(card)).toBe(true)
  })

  it("reads a path of our own site from public/, without any network call", async () => {
    const card = await generateCategoryCard({ id: "prod5", images: ["/uploads/a.png?v=3"] }, "Shoes", TEMPLATE)

    expect(isPng(card)).toBe(true)
    expect(m.readFile).toHaveBeenCalledWith(path.join(PUBLIC_DIR, "uploads", "a.png"))
    expect(m.fetchPublic).not.toHaveBeenCalled()
  })

  it("does not follow a path that climbs out of public/", async () => {
    m.fetchPublic.mockRejectedValue(new Error("refused"))

    await generateCategoryCard({ id: "prod6", images: ["/../../etc/passwd"] }, "Shoes", TEMPLATE)

    const readPaths = m.readFile.mock.calls.map((call) => String(call[0]))
    expect(readPaths.some((p) => p.includes("passwd"))).toBe(false)
    expect(readPaths.every((p) => p.startsWith(PUBLIC_DIR + path.sep))).toBe(true)
  })

  it("uses the neutral tile when the product has no photo", async () => {
    const card = await generateCategoryCard({ id: "prod7", images: [] }, "Shoes", TEMPLATE)

    expect(isPng(card)).toBe(true)
    expect(m.fetchPublic).not.toHaveBeenCalled()
  })

  it("serves the cached card without touching the network", async () => {
    const cached = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(16, 2)])
    m.readFile.mockImplementation(async (file: string) => {
      if (String(file).endsWith(`${path.sep}generated${path.sep}categories${path.sep}prod8.png`)) return cached
      throw new Error("ENOENT")
    })

    const card = await generateCategoryCard({ id: "prod8", images: ["https://cdn.example.test/p.png"] }, "Shoes", TEMPLATE)

    expect(card).toBe(cached)
    expect(m.fetchPublic).not.toHaveBeenCalled()
    expect(m.writeFile).not.toHaveBeenCalled()
  })
})
