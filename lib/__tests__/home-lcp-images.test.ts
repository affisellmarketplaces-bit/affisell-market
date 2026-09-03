import { describe, expect, it } from "vitest"

import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"

describe("pickHomeLcpImageUrls", () => {
  it("returns up to four unique card image hrefs (CDN or proxy)", () => {
    const products = [
      { id: "a", image: "https://cdn.example/a.jpg" },
      { id: "b", images: ["https://cdn.example/b.jpg"] },
      { id: "c", image: "https://cdn.example/a.jpg" },
      { id: "d", image: "https://cdn.example/c.jpg" },
      { id: "e", image: "https://cdn.example/d.jpg" },
      { id: "f", image: "https://cdn.example/e.jpg" },
    ]
    expect(pickHomeLcpImageUrls(products, 4)).toEqual([
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
      "https://cdn.example/c.jpg",
      "https://cdn.example/d.jpg",
    ])
  })

  it("uses listing card proxy when only base64 images exist", () => {
    expect(
      pickHomeLcpImageUrls(
        [{ id: "listing_1", images: ["data:image/jpeg;base64,abc"] }],
        2
      )
    ).toEqual(["/api/listing-card-image/listing_1"])
  })

  it("ignores rows without a listing id", () => {
    expect(pickHomeLcpImageUrls([{ image: "" }, { image: "/placeholder.png" }, null], 4)).toEqual(
      []
    )
  })
})
