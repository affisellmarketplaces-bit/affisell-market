import { describe, expect, it } from "vitest"

import {
  isAllowedTryOnGarmentUrl,
  isTryOnImageExtension,
  validateTryOnGarmentUrl,
} from "../try-on-url-validator"

describe("try-on-url-validator", () => {
  it("accepts vercel blob https png", () => {
    const url = "https://abc.public.blob.vercel-storage.com/garment.png"
    expect(isAllowedTryOnGarmentUrl(url)).toBe(true)
    expect(isTryOnImageExtension(url)).toBe(true)
    expect(validateTryOnGarmentUrl(url)).toBe(url)
  })

  it("accepts cloudinary jpg", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/garment.jpg"
    expect(validateTryOnGarmentUrl(url)).toBe(url)
  })

  it("rejects http and unknown hosts", () => {
    expect(isAllowedTryOnGarmentUrl("http://blob.vercel-storage.com/a.png")).toBe(false)
    expect(isAllowedTryOnGarmentUrl("https://evil.example.com/a.png")).toBe(false)
  })
})
