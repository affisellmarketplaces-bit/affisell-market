import { describe, expect, it } from "vitest"

import {
  computeObjectContainRect,
  pointerPercentInContainedImage,
} from "@/lib/product-image-zoom-bounds"

describe("product-image-zoom-bounds", () => {
  it("centers a wide image with letterboxing", () => {
    const r = computeObjectContainRect(400, 400, 800, 400, { top: 0, right: 0, bottom: 0, left: 0 })
    expect(r.width).toBe(400)
    expect(r.height).toBe(200)
    expect(r.top).toBe(100)
    expect(r.left).toBe(0)
  })

  it("maps pointer only inside the painted image", () => {
    const image = { left: 50, top: 100, width: 300, height: 200 }
    expect(pointerPercentInContainedImage(200, 200, image)).toEqual({ x: 50, y: 50 })
    expect(pointerPercentInContainedImage(10, 10, image)).toBeNull()
  })
})
