import { describe, expect, it, vi } from "vitest"

import { resolveSocialProductImageSrc } from "@/lib/social/resolve-social-product-image"

describe("resolveSocialProductImageSrc", () => {
  it("warns and returns null when image missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const src = await resolveSocialProductImageSrc(null, "prod-missing")
    expect(src).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      "[VIRAL_TEMPLATE_MISSING_IMAGE]",
      expect.objectContaining({ productId: "prod-missing" })
    )
    warn.mockRestore()
  })

  it("passes through data URLs", async () => {
    const data =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    await expect(resolveSocialProductImageSrc(data, "prod-data")).resolves.toBe(data)
  })
})
