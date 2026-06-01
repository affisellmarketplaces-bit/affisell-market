import { describe, expect, it } from "vitest"

import { isSupplierVideoFile } from "@/lib/supplier-variant-video-upload"

describe("isSupplierVideoFile", () => {
  it("accepts video mime types", () => {
    expect(isSupplierVideoFile({ type: "video/mp4", name: "x.bin" } as File)).toBe(true)
  })

  it("accepts common extensions without mime", () => {
    expect(isSupplierVideoFile({ type: "", name: "clip.MOV" } as File)).toBe(true)
  })

  it("rejects images", () => {
    expect(isSupplierVideoFile({ type: "image/jpeg", name: "a.jpg" } as File)).toBe(false)
  })
})
