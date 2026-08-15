import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

const uploadSupplierMediaBuffer = vi.fn()

vi.mock("@/lib/supplier-media-storage-core", () => ({
  SUPPLIER_MEDIA_STORAGE_UNAVAILABLE: "storage_unavailable",
  uploadSupplierMediaBuffer,
}))

describe("storefront-brand-media-storage.server", () => {
  beforeEach(() => {
    vi.resetModules()
    uploadSupplierMediaBuffer.mockReset()
    delete process.env.VERCEL
  })

  afterEach(() => {
    delete process.env.VERCEL
  })

  it("uploads logo to cloud storage on Vercel", async () => {
    process.env.VERCEL = "1"
    uploadSupplierMediaBuffer.mockResolvedValue({
      url: "https://blob.vercel-storage.com/brand-studio/logo.svg",
      storage: "vercel_blob",
    })

    const { persistBrandStudioMedia } = await import("@/lib/storefront-brand-media-storage.server")
    const result = await persistBrandStudioMedia({
      userId: "user-1",
      kind: "logo",
      ext: "svg",
      bytes: Buffer.from("<svg></svg>"),
    })

    expect(result.url).toContain("https://")
    expect(uploadSupplierMediaBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        subfolder: "brand-studio",
        ext: "svg",
        contentType: "image/svg+xml",
      })
    )
  })

  it("throws when cloud storage fails on Vercel", async () => {
    process.env.VERCEL = "1"
    uploadSupplierMediaBuffer.mockRejectedValue(new Error("no token"))

    const { persistBrandStudioMedia } = await import("@/lib/storefront-brand-media-storage.server")
    await expect(
      persistBrandStudioMedia({
        userId: "user-1",
        kind: "logo",
        ext: "svg",
        bytes: Buffer.from("<svg></svg>"),
      })
    ).rejects.toThrow("storage_unavailable")
  })
})
