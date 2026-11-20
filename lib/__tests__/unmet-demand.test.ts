import { describe, expect, it } from "vitest"

import { priceGapRequests, unansweredRequests, unmetDemandSignals, unmetSearches, type RequestRow, type SearchRow } from "@/lib/strategic-intelligence/unmet-demand"

const now = new Date("2026-11-17T08:00:00.000Z")
const old = new Date("2026-11-01T08:00:00.000Z")
const s = (userId: string | null, query: string, productId: string | null = null): SearchRow => ({ userId, query, productId })

describe("searches with no result — privacy first", () => {
  it("needs 3 different people (one person's search is never shown)", () => {
    const one = Array.from({ length: 20 }, () => s("u1", "lampe solaire jardin"))
    expect(unmetSearches(one)).toEqual([])
    const three = ["u1", "u2", "u3"].map((u) => s(u, "Lampe  Solaire Jardin"))
    expect(unmetSearches(three)).toEqual([{ query: "lampe solaire jardin", users: 3, searches: 3, zeroResult: 3 }])
  })

  it("queries carrying personal data are dropped whole, whoever typed them", () => {
    const rows = ["u1", "u2", "u3", "u4"].flatMap((u) => [s(u, "jean@example.com"), s(u, "12 rue des lilas"), s(u, "commande 4815162342")])
    expect(unmetSearches(rows)).toEqual([])
  })

  it("a query that usually finds something is not unmet; anonymous rows are ignored", () => {
    const rows = [s("u1", "chargeur usb", "p1"), s("u2", "chargeur usb", "p1"), s("u3", "chargeur usb"), s(null, "chargeur usb")]
    expect(unmetSearches(rows)).toEqual([])
  })
})

const req = (over: Partial<RequestRow>): RequestRow => ({ resellerId: "r1", title: "Tapis de yoga liège", category: "Sport", quotesCount: 0, targetPriceEur: null, createdAt: old, status: "open", quotePricesEur: [], ...over })

describe("reseller requests", () => {
  it("unanswered: open, no quote, ≥ 7 days, ≥ 3 requests from ≥ 2 resellers", () => {
    const rows = [req({ resellerId: "r1" }), req({ resellerId: "r2" }), req({ resellerId: "r2", title: "Bloc de yoga" }), req({ resellerId: "r3", createdAt: now }), req({ resellerId: "r4", quotesCount: 1 }), req({ status: "closed" })]
    expect(unansweredRequests(rows, now)).toEqual([{ category: "sport", requests: 3, resellers: 2, examples: ["Tapis de yoga liège", "Tapis de yoga liège", "Bloc de yoga"] }])
    expect(unansweredRequests(rows.slice(0, 2), now)).toEqual([])
  })

  it("price gap: the best quote is above the target price", () => {
    const rows = [10, 20, 30].map((pct) => req({ targetPriceEur: 10, quotePricesEur: [10 * (1 + pct / 100), 50] }))
    expect(priceGapRequests(rows)).toEqual([{ category: "sport", requests: 3, medianGapPct: 20, examples: ["Tapis de yoga liège", "Tapis de yoga liège", "Tapis de yoga liège"] }])
    expect(priceGapRequests([req({ targetPriceEur: 10, quotePricesEur: [9] })])).toEqual([])
  })
})

describe("signals", () => {
  it("facts with their limits; no e-mail anywhere", () => {
    const out = unmetDemandSignals(
      { searches: [{ query: "lampe solaire jardin", users: 12, searches: 20, zeroResult: 18 }], unanswered: [{ category: "sport", requests: 4, resellers: 3, examples: ["Tapis"] }], priceGaps: [], searchRowsRead: 20 },
      { observedAt: now.toISOString(), window: { from: "a", to: "b" } }
    )
    expect(out.map((x) => [x.id, x.priority])).toEqual([
      ["discovery:unmet-search:lampe-solaire-jardin", "important"],
      ["discovery:unanswered-requests:sport", "study"],
    ])
    expect(out[0]!.confidenceReason).toMatch(/pas une taille de marché/)
    expect(JSON.stringify(out)).not.toMatch(/@/)
  })
})
