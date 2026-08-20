import { describe, expect, it } from "vitest"

import { productContentHash } from "@/lib/supplier-sync/content-hash"

describe("supplier-sync content hash", () => {
  it("is stable for identical normalized input", () => {
    const a = productContentHash({
      name: " Hoodie ",
      description: "Soft cotton",
      basePriceCents: 4999,
      stock: 12,
      images: ["https://cdn/a.jpg", "https://cdn/b.jpg"],
      categoryLabel: "Apparel",
    })
    const b = productContentHash({
      name: "Hoodie",
      description: "Soft cotton",
      basePriceCents: 4999,
      stock: 12,
      images: ["https://cdn/b.jpg", "https://cdn/a.jpg"],
      categoryLabel: "Apparel",
    })
    expect(a).toBe(b)
  })

  it("changes when price changes", () => {
    const base = {
      name: "Hoodie",
      description: "Soft cotton",
      basePriceCents: 4999,
      stock: 12,
      images: [] as string[],
      categoryLabel: "Apparel",
    }
    const a = productContentHash(base)
    const b = productContentHash({ ...base, basePriceCents: 5999 })
    expect(a).not.toBe(b)
  })
})
