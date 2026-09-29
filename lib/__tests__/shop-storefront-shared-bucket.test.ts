import { describe, expect, it } from "vitest"

import { bucketOrderCount } from "@/lib/shop-storefront-shared"

describe("bucketOrderCount", () => {
  it("returns 0 for counts below 10 (renders as 'new store')", () => {
    expect(bucketOrderCount(0)).toBe(0)
    expect(bucketOrderCount(1)).toBe(0)
    expect(bucketOrderCount(9)).toBe(0)
  })

  it("floors to the nearest bucket at or below the count", () => {
    expect(bucketOrderCount(10)).toBe(10)
    expect(bucketOrderCount(24)).toBe(10)
    expect(bucketOrderCount(25)).toBe(25)
    expect(bucketOrderCount(49)).toBe(25)
    expect(bucketOrderCount(50)).toBe(50)
    expect(bucketOrderCount(99)).toBe(50)
    expect(bucketOrderCount(100)).toBe(100)
    expect(bucketOrderCount(249)).toBe(100)
  })

  it("never returns the exact count once it's not a bucket boundary", () => {
    expect(bucketOrderCount(147)).not.toBe(147)
    expect(bucketOrderCount(147)).toBe(100)
  })

  it("caps at the highest bucket for very large counts", () => {
    expect(bucketOrderCount(999_999)).toBe(10_000)
  })

  it("is stable at exact bucket boundaries", () => {
    expect(bucketOrderCount(500)).toBe(500)
    expect(bucketOrderCount(1000)).toBe(1000)
    expect(bucketOrderCount(5000)).toBe(5000)
    expect(bucketOrderCount(10_000)).toBe(10_000)
  })
})
