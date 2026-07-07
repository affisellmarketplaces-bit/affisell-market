import { describe, expect, it } from "vitest"

import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"

describe("pickHomeLcpImageUrls", () => {
  it("returns up to four unique http image urls", () => {
    const products = [
      { image: "https://cdn.example/a.jpg" },
      { images: ["https://cdn.example/b.jpg"] },
      { image: "https://cdn.example/a.jpg" },
      { image: "https://cdn.example/c.jpg" },
      { image: "https://cdn.example/d.jpg" },
      { image: "https://cdn.example/e.jpg" },
    ]
    expect(pickHomeLcpImageUrls(products, 4)).toEqual([
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
      "https://cdn.example/c.jpg",
      "https://cdn.example/d.jpg",
    ])
  })

  it("ignores empty and non-http values", () => {
    expect(pickHomeLcpImageUrls([{ image: "" }, { image: "/local.jpg" }, null], 4)).toEqual([])
  })
})
