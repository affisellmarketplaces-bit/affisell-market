import { describe, expect, it } from "vitest"

import { abandonedCartPushCopy } from "@/lib/web-push-send"

describe("abandonedCartPushCopy", () => {
  it("includes price when provided", () => {
    const copy = abandonedCartPushCopy({
      productName: "Serum Vit C",
      priceLabel: "29,90 €",
    })
    expect(copy.title).toContain("Serum Vit C")
    expect(copy.body).toContain("29,90 €")
  })

  it("falls back without price", () => {
    const copy = abandonedCartPushCopy({ productName: "Serum Vit C" })
    expect(copy.body).toContain("Finalisez")
  })
})
