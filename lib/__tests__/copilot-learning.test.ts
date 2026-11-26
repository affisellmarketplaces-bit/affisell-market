/**
 * Copilot learning loop (founder brief 2026-11-23): frozen snapshots, outcomes in the reseller's OWN shop with statuses
 * that never read an open window as a failure, measured situations with minimums, an automatic discovery engine that
 * finds planted effects and nothing in noise (false-discovery control), an offline ranking comparison that is never
 * applied, aggregates without identifiers, off by default.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  benjaminiHochberg,
  buildSnapshot,
  classifyCase,
  normalP,
  parseSnapshot,
  planLearningPurge,
  readCopilotLearningMode,
  situationTracks,
  SNAPSHOT_KEYS,
  type ProposalCase,
  type ProposalSnapshot,
  type ShopOrder,
  type SnapshotInput,
} from "@/lib/reseller-copilot/learning"
import { discover } from "@/lib/reseller-copilot/learning-discovery"
import { buildLearningReport } from "@/lib/reseller-copilot/learning-report"
import { simulateRanking } from "@/lib/reseller-copilot/learning-ranking-sim"
import { buildSelection, type SelectionCandidate } from "@/lib/reseller-copilot/selection"

const DAY = 86_400_000
const NOW = new Date("2026-11-23T12:00:00Z")
const ago = (d: number) => new Date(NOW.getTime() - d * DAY)

const snapIn = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  profile: "rentable_demande_a_construire",
  flags: [],
  rank: 1,
  rankCriterion: "net",
  readiness: "pret",
  netCents: 800,
  feeBps: 2000,
  feeDefault: true,
  missing: [],
  fit: null,
  categoryId: "cat-a",
  supplierPriceCents: 3000,
  paidOrders30d: 0,
  resellersListing: 2,
  ageDays: 60,
  offerMissingMeasured: 0,
  rising: false,
  stockKnown: true,
  shopListings: 12,
  ...over,
})
const order = (daysAgo: number, closed = false): ShopOrder => ({ paidAt: ago(daysAgo), quantity: 1, revenueHtCents: 4000, netCents: 700, closed })
const kase = (over: Partial<ProposalCase> = {}): ProposalCase => ({
  affiliateId: "aff-1",
  productId: "p-1",
  shownAt: ago(90),
  snapshot: buildSnapshot(snapIn()),
  listingCreatedAt: null,
  viaCopilot: false,
  orders: [],
  ...over,
})

describe("snapshot — frozen, closed, minimal", () => {
  it("a closed list of discrete fields, round-trips, refuses anything else", () => {
    const s = buildSnapshot(snapIn({ flags: ["sous_distribue"], ageDays: 10, offerMissingMeasured: 2 }))
    expect(Object.keys(s).sort()).toEqual([...SNAPSHOT_KEYS].sort())
    expect(parseSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s)
    expect(s.ageBand).toBe("<30")
    expect(s.offerBand).toBe("incomplete")
    expect(parseSnapshot({ ...s, method: "other" })).toBeNull()
    expect(parseSnapshot({ ...s, profile: "nope" })).toBeNull()
    expect(JSON.stringify(s)).not.toMatch(/name|email|price":|affiliate/i)
  })
})

describe("outcome — the reseller's own shop, statuses never mixed", () => {
  it("not added: an open window is « in progress », a closed one « not added »", () => {
    expect(classifyCase(kase({ shownAt: ago(10) }), NOW).status).toBe("observation_en_cours")
    expect(classifyCase(kase({ shownAt: ago(40) }), NOW).status).toBe("non_ajoute")
    expect(classifyCase(kase({ shownAt: ago(90), listingCreatedAt: ago(50) }), NOW).status).toBe("non_ajoute") // added 40 days after: outside
  })
  it("added: an open window is never a failure; then no sale / sold / sold then cancelled", () => {
    expect(classifyCase(kase({ shownAt: ago(20), listingCreatedAt: ago(19) }), NOW).status).toBe("ajoute_fenetre_ouverte")
    expect(classifyCase(kase({ listingCreatedAt: ago(85) }), NOW).status).toBe("ajoute_sans_vente")
    const sold = classifyCase(kase({ listingCreatedAt: ago(85), orders: [order(80), order(70, true), order(40)] }), NOW)
    expect(sold).toMatchObject({ status: "vendu", orders: 2, units: 2, closedOrders: 1, netCents: 700, revenueHtCents: 4000, daysToFirstSale: 5 })
    expect(classifyCase(kase({ listingCreatedAt: ago(85), orders: [order(80, true)] }), NOW).status).toBe("vendu_puis_annule")
    expect(classifyCase(kase({ snapshot: null }), NOW).status).toBe("donnees_insuffisantes")
  })
})

describe("statistics", () => {
  it("normal p-value and Benjamini–Hochberg", () => {
    expect(normalP(1.96)).toBeCloseTo(0.05, 2)
    // sorted 0.01, 0.03, 0.04, 0.5 → q = 0.04, 0.0533, 0.0533, 0.5 (monotone step-up), returned in input order
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.5])
    expect(q.map((v) => Math.round(v * 10_000) / 10_000)).toEqual([0.04, 0.0533, 0.0533, 0.5])
  })
})

/** Deterministic generator: `effect` gives the sale probability of an added case from its snapshot. */
function synthetic(n: number, effect: (s: ProposalSnapshot) => number, seed = 7): ProposalCase[] {
  let x = seed
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const out: ProposalCase[] = []
  for (let i = 0; i < n; i++) {
    // One served selection = 6 consecutive proposals of one reseller on one day, ranked 1..6.
    const sel = Math.floor(i / 6)
    const aff = `aff-${sel % 12}`
    const day = 200 - (Math.floor(sel / 12) % 170)
    const snap = buildSnapshot(
      snapIn({
        rank: (i % 6) + 1,
        flags: rnd() < 0.5 ? ["sous_distribue"] : [],
        profile: rnd() < 0.5 ? "rentable_valide" : "gain_faible",
        netCents: rnd() < 0.5 ? 150 : 900,
        categoryId: rnd() < 0.5 ? "cat-a" : "cat-b",
        rising: rnd() < 0.2,
      }),
    )
    const shownAt = ago(day)
    const added = rnd() < 0.7
    const sells = added && rnd() < effect(snap)
    out.push({
      affiliateId: aff,
      productId: `p-${i}`,
      shownAt,
      snapshot: snap,
      listingCreatedAt: added ? new Date(shownAt.getTime() + DAY) : null,
      viaCopilot: added,
      orders: sells ? [{ paidAt: new Date(shownAt.getTime() + 5 * DAY), quantity: 1, revenueHtCents: 3000, netCents: 600, closed: false }] : [],
    })
  }
  return out
}

describe("discovery engine — finds what is there, invents nothing", () => {
  const scored = (cs: ProposalCase[]) => cs.map((c) => ({ c, o: classifyCase(c, NOW) }))
  it("a planted effect is discovered and labelled; an under-rated weak signal is « sous_estime »", () => {
    const r = discover(scored(synthetic(1200, (s) => (s.flags.includes("sous_distribue") ? 0.6 : 0.15))))
    const d = r.discoveries.find((x) => x.outcome === "vente" && x.pattern.length === 1 && x.pattern[0] === "repere=sous_distribue")
    expect(d).toMatchObject({ kind: "succes" })
    expect(d!.q).toBeLessThanOrEqual(0.1)
    const weak = discover(scored(synthetic(1200, (s) => (s.profile === "gain_faible" ? 0.55 : 0.15))))
    expect(weak.discoveries.some((x) => x.kind === "sous_estime" && x.pattern.includes("situation=gain_faible"))).toBe(true)
  })
  it("pure noise: no discovery on the sale outcome, the families are « no difference detected »", () => {
    const r = discover(scored(synthetic(1200, () => 0.3, 11)))
    expect(r.discoveries.filter((d) => d.outcome === "vente")).toEqual([])
    expect(r.noDifferenceDetected.map((f) => f.family)).toEqual(expect.arrayContaining(["situation", "gain", "categorie"]))
  })
  it("too little data: nothing is judged", () => {
    const r = discover(scored(synthetic(30, (s) => (s.flags.length ? 0.9 : 0))))
    expect(r.discoveries).toEqual([])
    expect(r.notJudgeable.length).toBeGreaterThan(5)
  })
})

describe("offline ranking comparison — measured, never applied", () => {
  const scored = (cs: ProposalCase[]) => cs.map((c) => ({ c, o: classifyCase(c, NOW) }))
  it("a signal the current order ignores (low ranks with a feature sell) makes the learned order « meilleur »", () => {
    const sim = simulateRanking(scored(synthetic(2400, (s) => (s.rank >= 4 && s.flags.includes("sous_distribue") ? 0.85 : 0.05), 3)))
    expect(sim.applied).toBe(false)
    expect(sim.evaluated).toBeGreaterThanOrEqual(30)
    expect(sim.verdict).toBe("meilleur")
    expect(sim.topWeights.some((w) => w.feature === "repere=sous_distribue" && w.weight > 0)).toBe(true)
    expect(sim.biases).toContain("position_bias_favours_current")
  })
  it("no signal: not conclusive; too little: insufficient", () => {
    expect(simulateRanking(scored(synthetic(2400, () => 0.25, 5))).verdict).not.toBe("meilleur")
    expect(simulateRanking(scored(synthetic(40, () => 0.5))).verdict).toBe("insuffisant")
  })
})

describe("measured situations, report, confidentiality", () => {
  it("a situation is shown only with ≥ 20 mature additions from ≥ 5 resellers", () => {
    const few = Array.from({ length: 19 }, (_, i) => kase({ affiliateId: `a${i % 6}`, productId: `p${i}`, listingCreatedAt: ago(85) }))
    const t = situationTracks(few.map((c) => ({ c, o: classifyCase(c, NOW) })))
    expect(t.find((x) => x.profile === "rentable_demande_a_construire")!.verdict).toBe("insuffisant")
    const one = Array.from({ length: 40 }, (_, i) => kase({ affiliateId: "solo", productId: `p${i}`, listingCreatedAt: ago(85) }))
    expect(situationTracks(one.map((c) => ({ c, o: classifyCase(c, NOW) }))).find((x) => x.profile === "rentable_demande_a_construire")!.verdict).toBe("insuffisant")
  })
  it("the report carries aggregates only and its decision sheet is never applied", () => {
    const rep = buildLearningReport(synthetic(600, () => 0.3), NOW)
    expect(rep.decisionSheet.applied).toBe(false)
    expect(rep.ranking.applied).toBe(false)
    const txt = JSON.stringify(rep)
    expect(txt).not.toMatch(/aff-\d|"p-\d/)
    expect(rep.funnel.proposals).toBe(600)
    expect(rep.limits).toContain("association_not_cause")
  })
  it("the learning never changes the ranking: the same selection with or without measured situations", () => {
    const c = (id: string, base: number): SelectionCandidate => ({
      productId: id, name: id, imageUrl: null, basePriceCents: base, commissionRatePct: 15, commissionExplicit: true, stockUnits: 30, stockKnown: true,
      returnWindowDays: 14, paidOrders30d: 0, resellersListing: 2, inMyShop: false, awaitingReview: false, ageDays: 90,
    })
    const cands = [c("a", 3000), c("b", 5000), c("c", 1200)]
    const tracks = situationTracks(synthetic(600, () => 0.3).map((x) => ({ c: x, o: classifyCase(x, NOW) })))
    const without = buildSelection(cands, { affiliateFeeBps: null, limit: 3 }).selection.map((s) => s.productId)
    const withT = buildSelection(cands, { affiliateFeeBps: null, limit: 3, situationTracks: tracks }).selection.map((s) => s.productId)
    expect(withT).toEqual(without)
  })
  it("off by default; retention purge plan; the server reads each shop's own orders only", () => {
    expect(readCopilotLearningMode({})).toBe("off")
    expect(readCopilotLearningMode({ COPILOT_LEARNING_MODE: "observe" })).toBe("observe")
    expect(planLearningPurge([{ id: "old", createdAt: ago(211) }, { id: "new", createdAt: ago(10) }], NOW)).toEqual(["old"])
    const src = readFileSync(join(process.cwd(), "lib/reseller-copilot/learning.server.ts"), "utf8")
    expect(src).toMatch(/if \(readCopilotLearningMode\(\) === "off"\) return/)
    expect(src).toMatch(/affiliateId: \{ in: affiliates \}, productId: \{ in: products \}/)
    expect(src).not.toMatch(/anonymousId|sessionId|\.email\b|email: true/)
    const route = readFileSync(join(process.cwd(), "app/api/admin/copilot-learning/route.ts"), "utf8")
    expect(route).toContain("requireAdminSession")
  })
  it("the reseller-facing line exists in 8 locales and says it is not a promise", () => {
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const t = JSON.parse(readFileSync(join(process.cwd(), `messages/${loc}.json`), "utf8")).affiliate.copilot.opportunity.track
      expect(typeof t, loc).toBe("string")
    }
    expect(JSON.parse(readFileSync(join(process.cwd(), "messages/fr.json"), "utf8")).affiliate.copilot.opportunity.track).toMatch(/pas une promesse/)
  })
})
