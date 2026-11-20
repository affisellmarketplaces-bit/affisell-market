/**
 * Buyer side of portfolio idea I (2026-11-20): on a shop page, a sold-out exact variant → products ALREADY live in the
 * same shop that offer it in stock. Off by default; equivalence of the replacement engine; only public fields returned.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildReplacementProposal, type OriginalListing, type ReplacementCandidate } from "@/lib/reseller-replacement/match"
import { readShopAlternativesMode } from "@/lib/restock-watch/shop-alternatives"

const original: OriginalListing = {
  listingId: "lA",
  productId: "p1",
  name: "T-shirt coton bio noir",
  categoryId: "cat-tee",
  gtin14: null,
  brand: null,
  supplierPriceCents: 1000,
  commissionPct: 15,
  sellingPriceHtCents: 1300,
  colors: ["Noir"],
  sizes: ["M"],
  deliveryMaxDays: 7,
  returnWindowDays: 14,
  problem: null,
}
const cand = (over: Partial<ReplacementCandidate> = {}): ReplacementCandidate => ({
  productId: "p2",
  name: "T-shirt coton bio",
  imageUrl: "https://img/p2.jpg",
  categoryId: "cat-tee",
  gtin14: null,
  brand: null,
  supplierLabel: "Maison",
  supplierPriceCents: 900,
  commissionPct: 15,
  commissionExplicit: true,
  available: 5,
  mayList: true,
  colors: ["Noir"],
  sizes: ["M"],
  deliveryMaxDays: 5,
  returnWindowDays: 14,
  existingListing: { sellingPriceCents: 1200, isListed: true },
  defaultSellingPriceCents: 1170,
  wantedVariant: { status: "found", stock: 4 },
  ...over,
})

describe("in-shop-only wanted-variant mode", () => {
  it("keeps only products already live in the shop, with the same variant in stock and the same equivalence", () => {
    const p = buildReplacementProposal(
      original,
      [
        cand({ productId: "live" }),
        cand({ productId: "notInShop", existingListing: null }),
        cand({ productId: "unlisted", existingListing: { sellingPriceCents: 1200, isListed: false } }),
        cand({ productId: "soldOut", wantedVariant: { status: "found", stock: 0 } }),
        cand({ productId: "mug", name: "Mug céramique" }),
      ],
      { affiliateFeeBps: null, wantedVariant: true, inShopOnly: true }
    )
    expect(p.status).toBe("found")
    if (p.status === "found") expect(p.alternatives.map((a) => a.productId)).toEqual(["live"])
  })
  it("in-shop-only never applies outside the wanted-variant mode", () => {
    const p = buildReplacementProposal(original, [cand({ productId: "live" })], { affiliateFeeBps: null, inShopOnly: true })
    expect(p.status).toBe("none")
  })
})

describe("mode switch", () => {
  it("off unless exactly on", () => {
    expect(readShopAlternativesMode(undefined)).toBe("off")
    expect(readShopAlternativesMode("")).toBe("off")
    expect(readShopAlternativesMode("enforce")).toBe("off")
    expect(readShopAlternativesMode(" ON ")).toBe("on")
  })
})

const state = vi.hoisted(() => ({
  variant: null as unknown,
  proposal: null as unknown,
  listings: [] as Array<{ id: string; affiliateId: string; productId: string; customTitle: string | null; isListed: boolean }>,
  calls: { resolve: 0, proposal: [] as Array<{ affiliateId: string; opts: unknown }> },
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/restock-watch/restock-watch.server", () => ({
  resolveListingVariant: async () => {
    state.calls.resolve++
    return state.variant
  },
}))
vi.mock("@/lib/reseller-replacement/replace.server", () => ({
  loadReplacementProposal: async (affiliateId: string, _l: string, opts: unknown) => {
    state.calls.proposal.push({ affiliateId, opts })
    return { ok: true, proposal: state.proposal, listingIsListed: true }
  },
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: {
      findMany: async ({ where }: { where: { affiliateId: string; isListed: boolean; productId: { in: string[] } } }) =>
        state.listings.filter((l) => l.affiliateId === where.affiliateId && l.isListed && where.productId.in.includes(l.productId)),
    },
  },
}))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: async () => null }))

import { loadShopVariantAlternatives } from "@/lib/restock-watch/shop-alternatives.server"
import { GET } from "@/app/api/store/variant-alternatives/route"

describe("loader and public route", () => {
  beforeEach(() => {
    state.variant = { ok: true, key: "noir|m||", label: "Noir / M", stock: 0, affiliateId: "resA", isListed: true }
    state.proposal = buildReplacementProposal(original, [cand({ productId: "live" })], { affiliateFeeBps: 2000, wantedVariant: true, inShopOnly: true })
    state.listings = [
      { id: "lLive", affiliateId: "resA", productId: "live", customTitle: null, isListed: true },
      { id: "lOther", affiliateId: "resB", productId: "live", customTitle: null, isListed: true },
    ]
    state.calls = { resolve: 0, proposal: [] }
  })
  afterEach(() => {
    delete process.env.SHOP_VARIANT_ALTERNATIVES_MODE
  })

  it("off by default: nothing is read", async () => {
    expect(await loadShopVariantAlternatives("lA", { color: "Noir", size: "M" })).toEqual({ mode: "off" })
    expect(state.calls.resolve).toBe(0)
  })

  it("on: the shop's own listing, public fields only — no net, price, supplier or stock", async () => {
    process.env.SHOP_VARIANT_ALTERNATIVES_MODE = "on"
    const r = await loadShopVariantAlternatives("lA", { color: "Noir", size: "M" })
    expect(r).toEqual({ mode: "on", status: "found", variantLabel: "Noir / M", items: [{ listingId: "lLive", name: "T-shirt coton bio", imageUrl: "https://img/p2.jpg", match: "similaire" }] })
    expect(state.calls.proposal).toEqual([{ affiliateId: "resA", opts: { wantedVariantKey: "noir|m||", inShopOnly: true } }])
    expect(JSON.stringify(r)).not.toMatch(/net|Cents|supplier|Maison|lOther|units/i)
  })

  it("on: nothing while the variant is available, unresolved or the listing hidden", async () => {
    process.env.SHOP_VARIANT_ALTERNATIVES_MODE = "on"
    state.variant = { ok: true, key: "k", label: "x", stock: 3, affiliateId: "resA", isListed: true }
    expect(await loadShopVariantAlternatives("lA", {})).toEqual({ mode: "on", status: "not_sold_out" })
    state.variant = { ok: false, error: "variant_incomplete" }
    expect(await loadShopVariantAlternatives("lA", {})).toEqual({ mode: "on", status: "variant_unresolved" })
    state.variant = { ok: true, key: "k", label: "x", stock: 0, affiliateId: "resA", isListed: false }
    expect(await loadShopVariantAlternatives("lA", {})).toEqual({ mode: "on", status: "variant_unresolved" })
    expect(state.calls.proposal).toHaveLength(0)
  })

  it("the route validates its query and answers off by default", async () => {
    expect((await GET(new Request("http://x/api/store/variant-alternatives"))).status).toBe(400)
    const res = await GET(new Request("http://x/api/store/variant-alternatives?listingId=lA&color=Noir&size=M"))
    expect(await res.json()).toEqual({ mode: "off" })
  })
})

describe("8 locales", () => {
  it("every text exists", () => {
    for (const l of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(readFileSync(join(process.cwd(), `messages/${l}.json`), "utf8")) as { boutique: { variantAlternatives: Record<string, string> } }
      expect(Object.keys(m.boutique.variantAlternatives).sort()).toEqual(["note", "same", "similar", "title"])
      expect(m.boutique.variantAlternatives.title).toContain("{variant}")
    }
  })
})
