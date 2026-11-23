/**
 * RESELLER COPILOT — discovery engine (founder brief 2026-11-23 §4). Pure, client-safe, no AI call.
 *
 * Nobody writes the hypotheses: every discrete feature of the FROZEN snapshots (situation, flags, rank band, readiness,
 * availability, affinity, price / net / demand / competition / age / offer bands, rise, shop size, fee type, category)
 * and every PAIR of them is tested automatically, on two outcomes:
 *   - `vente`  among MATURE additions: the addition was followed by a paid, not-cancelled order in the reseller's shop
 *              within 30 days (`vendu`);
 *   - `ajout`  among MATURE proposals: the reseller added the product within 30 days (selection behaviour).
 * A pattern is tested only with ≥ 20 cases from ≥ 5 resellers on each side (it vs the rest). Two-proportion z, p-values,
 * Benjamini–Hochberg false-discovery control at 10 % over EVERY pattern tested for that outcome (pairs included) — so
 * « a discovery » survives the search that found it. Kinds:
 *   `succes` / `echec`      the pattern sells more / less often than the rest;
 *   `sous_estime`           sells more often although the snapshot carried a WEAK signal (low-gain or « demand to build »
 *                           situation, rank 7+, no recent orders, incomplete offer) — the copilot under-rated it;
 *   `surestime`             sells less often although it carried a STRONG signal (« validated », top-3 rank, tested
 *                           rise) — the copilot over-rated it;
 *   (and on `ajout`) `adopte_plus` / `adopte_moins`.
 * Signals WITHOUT measured value: a feature family with ≥ 2 values measured and no discovery among them is reported as
 * « no difference detected » with its case count — an absence of evidence, not a proof of no effect.
 * Associations observed on chosen additions, NEVER causes.
 */
import { benjaminiHochberg, isMatureAdd, isMatureProposal, LEARNING_MIN_CASES, LEARNING_MIN_RESELLERS, normalP, snapshotFeatures, twoProportionZ, type ScoredCase } from "@/lib/reseller-copilot/learning"

export const DISCOVERY_FDR = 0.1
export const DISCOVERY_MAX_PATTERNS = 4000

const WEAK = new Set(["situation=gain_faible", "situation=rentable_demande_a_construire", "rang=7+", "demande=0", "offre=incomplete"])
const STRONG = new Set(["situation=rentable_valide", "rang=1-3", "progression=oui"])

export type DiscoveryOutcome = "vente" | "ajout"
export type DiscoveryKind = "succes" | "echec" | "sous_estime" | "surestime" | "adopte_plus" | "adopte_moins"

export type PatternResult = {
  outcome: DiscoveryOutcome
  pattern: string[]
  cases: number
  resellers: number
  share: number
  restShare: number
  lift: number
  z: number
  q: number
}
export type Discovery = PatternResult & { kind: DiscoveryKind }

export type DiscoveryReport = {
  tested: Record<DiscoveryOutcome, number>
  discoveries: Discovery[]
  /** Feature families with ≥ 2 measured values and no discovery (absence of evidence, said so). */
  noDifferenceDetected: Array<{ family: string; values: number; cases: number }>
  /** Families with fewer than 2 measured values: not judgeable yet. */
  notJudgeable: string[]
  truncated: boolean
  nature: "association_observee"
}

type Unit = { affiliateId: string; features: string[]; success: boolean }

function units(cases: ReadonlyArray<ScoredCase>, outcome: DiscoveryOutcome): Unit[] {
  const out: Unit[] = []
  for (const { c, o } of cases) {
    if (!c.snapshot) continue
    if (outcome === "vente" ? !isMatureAdd(o) : !isMatureProposal(o)) continue
    out.push({ affiliateId: c.affiliateId, features: snapshotFeatures(c.snapshot), success: outcome === "vente" ? o.status === "vendu" : isMatureAdd(o) })
  }
  return out
}

function testOutcome(us: Unit[], outcome: DiscoveryOutcome): { results: PatternResult[]; truncated: boolean } {
  const support = new Map<string, number>()
  for (const u of us) for (const f of u.features) support.set(f, (support.get(f) ?? 0) + 1)
  const frequent = [...support].filter(([, n]) => n >= LEARNING_MIN_CASES).map(([f]) => f).sort()
  const family = (f: string) => f.split("=")[0]!
  const patterns: string[][] = frequent.map((f) => [f])
  for (let i = 0; i < frequent.length; i++)
    for (let j = i + 1; j < frequent.length; j++) if (family(frequent[i]!) !== family(frequent[j]!)) patterns.push([frequent[i]!, frequent[j]!])
  const truncated = patterns.length > DISCOVERY_MAX_PATTERNS
  const raw: Array<Omit<PatternResult, "q"> & { p: number }> = []
  for (const pattern of patterns.slice(0, DISCOVERY_MAX_PATTERNS)) {
    const inP = us.filter((u) => pattern.every((f) => u.features.includes(f)))
    const rest = us.filter((u) => !pattern.every((f) => u.features.includes(f)))
    const rIn = new Set(inP.map((u) => u.affiliateId)).size
    const rRest = new Set(rest.map((u) => u.affiliateId)).size
    if (inP.length < LEARNING_MIN_CASES || rest.length < LEARNING_MIN_CASES || rIn < LEARNING_MIN_RESELLERS || rRest < LEARNING_MIN_RESELLERS) continue
    const a = inP.filter((u) => u.success).length
    const b = rest.filter((u) => u.success).length
    const z = twoProportionZ(a, inP.length, b, rest.length)
    const share = a / inP.length
    const restShare = b / rest.length
    raw.push({ outcome, pattern, cases: inP.length, resellers: rIn, share, restShare, lift: restShare > 0 ? share / restShare : share > 0 ? Infinity : 1, z, p: normalP(z) })
  }
  const q = benjaminiHochberg(raw.map((r) => r.p))
  return { results: raw.map(({ p: _p, ...r }, i) => ({ ...r, q: q[i]! })), truncated }
}

function kindOf(r: PatternResult): DiscoveryKind {
  if (r.outcome === "ajout") return r.z > 0 ? "adopte_plus" : "adopte_moins"
  if (r.z > 0) return r.pattern.some((f) => WEAK.has(f)) ? "sous_estime" : "succes"
  return r.pattern.some((f) => STRONG.has(f)) ? "surestime" : "echec"
}

export function discover(cases: ReadonlyArray<ScoredCase>, opts: { truncated?: boolean } = {}): DiscoveryReport {
  if (opts.truncated) return { tested: { vente: 0, ajout: 0 }, discoveries: [], noDifferenceDetected: [], notJudgeable: [], truncated: true, nature: "association_observee" }
  const sale = testOutcome(units(cases, "vente"), "vente")
  const adopt = testOutcome(units(cases, "ajout"), "ajout")
  const discoveries = [...sale.results, ...adopt.results]
    .filter((r) => r.q <= DISCOVERY_FDR)
    .map((r) => ({ ...r, kind: kindOf(r) }))
    .sort((a, b) => a.q - b.q || Math.abs(b.z) - Math.abs(a.z))
  // Signals without measured value (sale outcome, single features only).
  const singles = sale.results.filter((r) => r.pattern.length === 1)
  const families = new Map<string, PatternResult[]>()
  for (const r of singles) {
    const fam = r.pattern[0]!.split("=")[0]!
    families.set(fam, [...(families.get(fam) ?? []), r])
  }
  const noDifferenceDetected: DiscoveryReport["noDifferenceDetected"] = []
  const notJudgeable: string[] = []
  const ALL = ["situation", "repere", "rang", "pret", "dispo", "affinite", "prix", "gain", "demande", "concurrence", "anciennete", "offre", "progression", "taille_boutique", "frais", "categorie"]
  for (const fam of ALL) {
    const rs = families.get(fam) ?? []
    if (rs.length < 2) notJudgeable.push(fam)
    else if (!rs.some((r) => r.q <= DISCOVERY_FDR)) noDifferenceDetected.push({ family: fam, values: rs.length, cases: rs.reduce((s, r) => s + r.cases, 0) })
  }
  return { tested: { vente: sale.results.length, ajout: adopt.results.length }, discoveries: discoveries.slice(0, 50), noDifferenceDetected, notJudgeable, truncated: sale.truncated || adopt.truncated, nature: "association_observee" }
}
