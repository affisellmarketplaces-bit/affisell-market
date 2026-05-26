import { describe, expect, it } from "vitest"

import {
  buildListingProductContext,
  extractProductIdentityFromTitle,
  formatListingContextForAi,
} from "@/lib/listing-product-signal"

describe("extractProductIdentityFromTitle", () => {
  it("extracts ventilateur from noisy marketplace title", () => {
    const r = extractProductIdentityFromTitle(
      "Ventilateur portable USB rechargeable mini bureau | Livraison gratuite | Noir"
    )
    expect(r.productName.toLowerCase()).toContain("ventilateur")
    expect(r.productName.toLowerCase()).toContain("portable")
    expect(r.productName.toLowerCase()).not.toContain("livraison")
    expect(r.confidence).toBeGreaterThan(0.6)
  })

  it("uses leading segment before pipe", () => {
    const r = extractProductIdentityFromTitle("Commode 6 tiroirs bois | Promo été")
    expect(r.productName.toLowerCase()).toContain("commode")
    expect(r.productName.toLowerCase()).not.toContain("promo")
  })
})

describe("buildListingProductContext", () => {
  it("prioritizes title over long description in classification focus", () => {
    const ctx = buildListingProductContext(
      "Ventilateur portable USB",
      "Lampe LED intégrée power bank 10000mAh pour camping"
    )
    expect(ctx.classificationFocus.toLowerCase()).toContain("ventilateur")
    const aiBlock = formatListingContextForAi(ctx)
    expect(aiBlock).toContain("PRIORITÉ 1")
    expect(aiBlock).toContain("Ventilateur")
    expect(aiBlock).toContain("PRIORITÉ 2")
  })
})
