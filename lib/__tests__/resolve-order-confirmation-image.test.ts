import { describe, expect, it, beforeEach, afterEach } from "vitest"

import {
  emailProductImageFallbackUrl,
  resolveOrderConfirmationImageUrl,
  toAbsoluteHttpsEmailImageUrl,
} from "@/lib/emails/resolve-order-confirmation-image"

describe("resolveOrderConfirmationImageUrl", () => {
  const prevAppUrl = process.env.APP_URL

  beforeEach(() => {
    process.env.APP_URL = "https://affisell.com"
  })

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.APP_URL
    else process.env.APP_URL = prevAppUrl
  })

  it("prefers variant snapshot then custom listing image", () => {
    const url = resolveOrderConfirmationImageUrl({
      variantImageUrl: "https://cdn.example.com/variant.jpg",
      customImages: ["https://cdn.example.com/custom.jpg"],
      productImages: ["https://cdn.example.com/product.jpg"],
    })
    expect(url).toBe("https://cdn.example.com/variant.jpg")
  })

  it("absolutizes relative product paths for email clients", () => {
    const url = resolveOrderConfirmationImageUrl({
      productImages: ["/uploads/commode.jpg"],
    })
    expect(url).toBe("https://affisell.com/uploads/commode.jpg")
  })

  it("falls back to hosted placeholder on our domain", () => {
    expect(resolveOrderConfirmationImageUrl({})).toBe(
      "https://affisell.com/placeholder-product.jpg"
    )
    expect(emailProductImageFallbackUrl()).toBe("https://affisell.com/placeholder-product.jpg")
  })

  it("upgrades http to https", () => {
    expect(toAbsoluteHttpsEmailImageUrl("http://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg"
    )
  })
})
