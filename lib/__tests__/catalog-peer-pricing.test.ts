import { describe, expect, it } from "vitest"

import {
  buildCatalogPeerBenchmark,
  resolveCatalogPriceSuggestion,
} from "@/lib/supplier/catalog-peer-pricing"

describe("catalog-peer-pricing", () => {
  it("builds median from peer catalog prices", () => {
    const bench = buildCatalogPeerBenchmark([2_000, 2_500, 3_000, 4_000])
    expect(bench.peerCount).toBe(4)
    expect(bench.medianCents).toBe(2_750)
  })

  it("prefers peer median over margin floor", () => {
    const peer = buildCatalogPeerBenchmark([2_000, 2_400, 2_800])
    const resolved = resolveCatalogPriceSuggestion({
      breakEvenPriceCents: 1_500,
      marginTargetPriceCents: 3_500,
      peer,
    })
    expect(resolved.suggestedPriceSource).toBe("catalog_peers")
    expect(resolved.suggestedPriceCents).toBe(2_400)
    expect(resolved.catalogPeerCount).toBe(3)
  })

  it("floors peer suggestion at break-even", () => {
    const peer = buildCatalogPeerBenchmark([1_000, 1_200])
    const resolved = resolveCatalogPriceSuggestion({
      breakEvenPriceCents: 1_800,
      marginTargetPriceCents: 2_500,
      peer,
    })
    expect(resolved.suggestedPriceCents).toBe(1_800)
  })

  it("falls back to margin floor without enough peers", () => {
    const resolved = resolveCatalogPriceSuggestion({
      breakEvenPriceCents: 1_500,
      marginTargetPriceCents: 2_340,
      peer: buildCatalogPeerBenchmark([2_000]),
    })
    expect(resolved.suggestedPriceSource).toBe("margin_floor")
    expect(resolved.suggestedPriceCents).toBe(2_340)
  })
})
