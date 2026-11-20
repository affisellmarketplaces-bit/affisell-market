import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { isValidGtin } from "@/lib/listing-compliance/gtin"
import { computeResellerNetPerSale } from "@/lib/reseller-copilot/net-per-sale"
import { availableUnits, listingProblem } from "@/lib/reseller-replacement/listing-state"
import { readUnsellableAlertsMode, unsellableAlertId } from "@/lib/reseller-replacement/unsellable-alerts"
import {
  observationId,
  observedMarkerId,
  parseObservation,
  summarizeObservation,
  summarizeObservations,
} from "@/lib/reseller-replacement/unsellable-observation"
import {
  buildReplacementProposal,
  gtin14,
  nameSimilarity,
  variantCoverage,
  type OriginalListing,
  type ReplacementCandidate,
} from "@/lib/reseller-replacement/match"

const root = path.resolve(__dirname, "../..")
const read = (f: string) => readFileSync(path.join(root, f), "utf8")

const original: OriginalListing = {
  listingId: "l1",
  productId: "p1",
  name: "Lampe de bureau LED pliable noire",
  categoryId: "cat-lamp",
  gtin14: "04006381333931",
  brand: "Lumio",
  supplierPriceCents: 2000,
  commissionPct: 15,
  sellingPriceHtCents: 2600,
  colors: ["Noir", "Blanc"],
  sizes: [],
  deliveryMaxDays: 7,
  returnWindowDays: 14,
  problem: "out_of_stock",
}

function cand(over: Partial<ReplacementCandidate> = {}): ReplacementCandidate {
  return {
    productId: "p2",
    name: "Lampe de bureau LED pliable",
    imageUrl: null,
    categoryId: "cat-lamp",
    gtin14: null,
    brand: "Lumio",
    supplierLabel: "Maison Lune",
    supplierPriceCents: 1900,
    commissionPct: 15,
    commissionExplicit: true,
    available: 12,
    mayList: true,
    colors: ["Noir", "Blanc"],
    sizes: [],
    deliveryMaxDays: 5,
    returnWindowDays: 30,
    existingListing: null,
    defaultSellingPriceCents: 2470,
    ...over,
  }
}

describe("replacing an unsellable product (founder brief 2026-11-19)", () => {
  it("same barcode = identical, ranked first; similar needs category + name + variants", () => {
    const p = buildReplacementProposal(
      original,
      [cand({ productId: "sim" }), cand({ productId: "same", name: "Autre nom", categoryId: "x", gtin14: "04006381333931" })],
      { affiliateFeeBps: null }
    )
    expect(p.status).toBe("found")
    if (p.status !== "found") return
    expect(p.alternatives.map((a) => [a.productId, a.match])).toEqual([
      ["same", "identique"],
      ["sim", "similaire"],
    ])
  })

  it("an unrelated product is never proposed — « no reliable alternative » instead", () => {
    const p = buildReplacementProposal(original, [cand({ name: "Tapis de yoga antidérapant" })], { affiliateFeeBps: null })
    expect(p).toMatchObject({ status: "none", reason: "no_reliable_match" })
    const otherCategory = buildReplacementProposal(original, [cand({ categoryId: "other" })], { affiliateFeeBps: null })
    expect(otherCategory).toMatchObject({ status: "none", reason: "no_reliable_match" })
    const fewVariants = buildReplacementProposal(original, [cand({ colors: ["Rouge"] })], { affiliateFeeBps: null })
    expect(fewVariants).toMatchObject({ status: "none", reason: "no_reliable_match" })
  })

  it("only products that can really be sold today are candidates", () => {
    for (const bad of [
      { commissionExplicit: false },
      { mayList: false },
      { available: 0 },
      { available: null },
      { supplierPriceCents: 0 },
      { existingListing: { sellingPriceCents: 3000, isListed: true } },
      { productId: "p1" },
    ] as Partial<ReplacementCandidate>[]) {
      expect(buildReplacementProposal(original, [cand(bad)], { affiliateFeeBps: null })).toMatchObject({
        status: "none",
        reason: "no_sellable_candidate",
      })
    }
  })

  it("net per sale on both sides uses the settlement-pinned function and the price that will REALLY be written", () => {
    const p = buildReplacementProposal(
      original,
      [cand({ existingListing: { sellingPriceCents: 3100, isListed: false } })],
      { affiliateFeeBps: 1500 }
    )
    if (p.status !== "found") throw new Error("expected found")
    const a = p.alternatives[0]!
    expect(a.sellingPriceHtCents).toBe(3100)
    expect(a.net).toEqual(
      computeResellerNetPerSale({ supplierPriceCents: 1900, commissionRatePct: 15, sellingPriceHtCents: 3100, affiliateFeeBps: 1500 })
    )
    expect(p.originalNet.netCents).toBe(
      computeResellerNetPerSale({ supplierPriceCents: 2000, commissionRatePct: 15, sellingPriceHtCents: 2600, affiliateFeeBps: 1500 }).netCents
    )
    const delivery = a.differences.find((d) => d.field === "delivery")
    expect(delivery).toMatchObject({ before: 7, after: 5, direction: "better" })
  })

  it("differences name the missing options and a brand change", () => {
    const p = buildReplacementProposal(
      original,
      [cand({ colors: ["Noir"], brand: "Autre", name: "Lampe bureau LED pliable noire" })],
      { affiliateFeeBps: null }
    )
    if (p.status !== "found") throw new Error("expected found")
    const fields = p.alternatives[0]!.differences.map((d) => d.field)
    expect(fields).toContain("variants_missing")
    expect(fields).toContain("brand")
  })

  it("helpers", () => {
    expect(nameSimilarity("Lampe LED noire", "lampe led noire")).toBe(1)
    expect(nameSimilarity("Lampe", "Tapis")).toBe(0)
    expect(variantCoverage({ colors: ["Noir"], sizes: ["M"] }, { colors: ["noir"], sizes: [] }).coverage).toBe(0.5)
    expect(gtin14("4006381333931", isValidGtin)).toBe("04006381333931")
    expect(gtin14("4006381333932", isValidGtin)).toBeNull()
  })

  it("listing state: one definition for the action card and the replacement", () => {
    const base = { active: true, isDraft: false, tags: [], stock: 0, hasVariants: false, variants: null, listingKind: "PHYSICAL", commissionRate: 15, offerMode: "STANDARD" }
    expect(listingProblem(base)).toBe("out_of_stock")
    expect(listingProblem({ ...base, stock: 3 })).toBeNull()
    expect(listingProblem({ ...base, active: false })).toBe("product_unavailable")
    expect(listingProblem({ ...base, stock: 3, commissionRate: 0 })).toBe("no_commission")
    expect(availableUnits({ ...base, variants: { variantRows: [{ stock: 2 }, { stock: 1 }] } })).toBe(3)
    expect(availableUnits({ ...base, hasVariants: true })).toBeNull()
  })

  it("nothing is deleted and no order is touched: the old listing is only unlisted, after the add succeeded", () => {
    const src = read("lib/reseller-replacement/replace.server.ts")
    expect(src).not.toMatch(/\.delete(Many)?\(/)
    expect(src).not.toMatch(/order\.(update|create|delete)/)
    const body = src.slice(src.indexOf("export async function replaceListing("), src.indexOf("export async function finishReplacement("))
    expect(body.indexOf("quickAddAffiliateListing({")).toBeGreaterThan(0)
    expect(body.indexOf("quickAddAffiliateListing({")).toBeLessThan(body.indexOf("withdrawReplacedListing({"))
    expect(src).toContain("action: REPLACE_DONE_ACTION")
    expect(read("lib/reseller-replacement/resume.ts")).toContain('REPLACE_DONE_ACTION = "affiliate.listing_replaced"')
    const route = read("app/api/affiliate/listings/[id]/replacement/route.ts")
    expect(route).toContain('session.user.role !== "AFFILIATE"')
    expect(route).toContain("body.confirm !== true")
    expect(route).toContain("assertSameSiteRequestOrigin")
  })

  it("texts exist in the 8 locales", () => {
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(read(`messages/${loc}.json`))
      expect(m.affiliate.replacement.problem.out_of_stock, loc).toBeTruthy()
      expect(m.affiliate.replacement.none.no_reliable_match, loc).toBeTruthy()
      expect(m.affiliate.replacement.col.what, loc).toBeTruthy()
    }
  })

  it("unsellable-listing alerts: observe by default, one id per listing / problem / 14-day window", () => {
    expect(readUnsellableAlertsMode(undefined)).toBe("observe")
    expect(readUnsellableAlertsMode("enforce")).toBe("enforce")
    expect(readUnsellableAlertsMode("off")).toBe("off")
    const d1 = new Date("2026-11-19T08:00:00Z")
    const d2 = new Date("2026-11-19T20:00:00Z")
    expect(unsellableAlertId("l1", "out_of_stock", d1)).toBe(unsellableAlertId("l1", "out_of_stock", d2))
    expect(unsellableAlertId("l1", "out_of_stock", d1)).not.toBe(unsellableAlertId("l1", "no_commission", d1))
    const server = read("lib/reseller-replacement/unsellable-alerts.server.ts")
    // observe: the item is measured, then the loop moves on BEFORE any claim or bell notification.
    const observeBranch = server.indexOf('if (mode === "observe") {')
    expect(observeBranch).toBeGreaterThan(0)
    expect(server.slice(observeBranch, observeBranch + 600)).toContain("return run")
    expect(observeBranch).toBeLessThan(server.indexOf("notification.create"))
    expect(server.slice(server.indexOf("async function recordObservation"))).not.toContain("notification.")
    expect(server).not.toMatch(/affiliateProduct\.(update|delete)/)
    expect(read(".github/workflows/scheduled-crons.yml")).toContain('"/api/cron/reseller-unsellable-alerts"')
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(read(`messages/${loc}.json`))
      expect(m.affiliate.replacement.bellMessage, loc).toContain("{product}")
      expect(m.merchantNotifications.viewReplacement, loc).toBeTruthy()
    }
  })

  it("observation: counts only, new notices measured apart from the real claim, malformed rows ignored", () => {
    const now = new Date("2026-11-19T06:00:00Z")
    const items = [
      { affiliateId: "a1", listingId: "l1", problem: "out_of_stock" as const },
      { affiliateId: "a1", listingId: "l2", problem: "no_commission" as const },
      { affiliateId: "a2", listingId: "l3", problem: "out_of_stock" as const },
    ]
    const o = summarizeObservation({ now, scanned: 30, truncated: false, items, newItems: items.slice(0, 2), inAppOff: new Set(["a1"]) })
    expect(o).toMatchObject({
      day: "2026-11-19",
      unsellable: 3,
      unsellableShare: 0.1,
      resellersAffected: 2,
      maxPerReseller: 2,
      wouldNotifyNew: 2,
      wouldSkipPreference: 2,
    })
    expect(o.byProblem).toEqual({ out_of_stock: 2, product_unavailable: 0, awaiting_review: 0, no_commission: 1 })
    expect(JSON.stringify(o)).not.toMatch(/l1|a1/)
    expect(observationId(now)).toBe("unsellable-alerts-observation:2026-11-19")
    expect(observedMarkerId("l1", "out_of_stock", 42)).not.toBe(unsellableAlertId("l1", "out_of_stock", now))
    expect(parseObservation(JSON.parse(JSON.stringify(o)))).toEqual(o)
    expect(parseObservation({ day: "x" })).toBeNull()
    const trend = summarizeObservations([o, { ...o, day: "2026-11-18", wouldNotifyNew: 5 }])
    expect(trend).toMatchObject({ days: 2, peakWouldNotifyNew: 5, reading: "too_few_days" })
    expect(summarizeObservations([]).reading).toBe("no_data")
  })
})
