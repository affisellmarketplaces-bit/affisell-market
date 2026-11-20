import { binomialUpperTail } from "@/lib/strategic-intelligence/quality-risk"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — emerging products, BEFORE they become commonplace (pure).
 *
 * "Emerging" = a product whose paid orders accelerate clearly MORE than the marketplace as a whole, while few resellers
 * offer it yet. That window — proven, accelerating demand and little supply — is when recruiting resellers onto it is
 * worth the most; once every reseller lists it, the margin is competed away.
 *
 * Test (exact, no normal approximation, small counts allowed):
 *  - recent window = the last RECENT_DAYS days, reference = the PRIOR_DAYS days before it;
 *  - if the product followed the marketplace, given its T = recent + prior orders, the recent count would be
 *    Binomial(T, q) with q = RECENT·g / (RECENT·g + PRIOR), g = the marketplace's own growth (daily rate recent / prior).
 *    So a marketplace-wide surge (sales, Black Friday) is NOT read as many emerging products;
 *  - P(X ≥ recent) must be below 5 % / (number of products tested) — Bonferroni;
 *  - size floors: T ≥ MIN_TOTAL, recent ≥ MIN_RECENT, and the product's growth ≥ MIN_LIFT × the marketplace's.
 * Units are ORDERS (independent purchases), not quantities: one buyer taking 20 pieces is not 20 signals of demand.
 */
export const EMERGING_RECENT_DAYS = 14
export const EMERGING_PRIOR_DAYS = 42
export const EMERGING_MIN_TOTAL = 8
export const EMERGING_MIN_RECENT = 5
export const EMERGING_MIN_LIFT = 2
/** At most this many resellers listing it = still "before commonplace". */
export const EMERGING_FEW_RESELLERS = 3
const FAMILY_ALPHA = 0.05

export type EmergingCounts = { productId: string; name: string; recent: number; prior: number; sellingResellers: number }

export type EmergingFinding = EmergingCounts & { growth: number; marketGrowth: number; pValue: number; threshold: number }

const dailyGrowth = (recent: number, prior: number) => (recent / EMERGING_RECENT_DAYS) / (prior / EMERGING_PRIOR_DAYS)

export function detectEmerging(rows: EmergingCounts[], market: { recent: number; prior: number }): EmergingFinding[] {
  // Without a reference period the marketplace growth is undefined: no comparison is made.
  if (market.prior <= 0 || market.recent <= 0) return []
  const marketGrowth = dailyGrowth(market.recent, market.prior)
  const q = (EMERGING_RECENT_DAYS * marketGrowth) / (EMERGING_RECENT_DAYS * marketGrowth + EMERGING_PRIOR_DAYS)
  const tested = rows.filter((r) => r.recent + r.prior >= EMERGING_MIN_TOTAL)
  if (tested.length === 0) return []
  const threshold = FAMILY_ALPHA / tested.length
  const out: EmergingFinding[] = []
  for (const r of tested) {
    if (r.recent < EMERGING_MIN_RECENT) continue
    const growth = r.prior > 0 ? dailyGrowth(r.recent, r.prior) : Number.POSITIVE_INFINITY
    if (growth < EMERGING_MIN_LIFT * marketGrowth) continue
    const pValue = binomialUpperTail(r.recent, r.recent + r.prior, q)
    if (pValue <= threshold) out.push({ ...r, growth, marketGrowth, pValue, threshold })
  }
  return out.sort((a, b) => a.pValue - b.pValue)
}

const ratioTxt = (x: number) => (Number.isFinite(x) ? `×${x.toFixed(1).replace(".", ",")}` : "nouveau (aucune vente avant)")

export function emergingSignals(
  findings: EmergingFinding[],
  listed: Map<string, number>,
  ctx: { observedAt: string; window: { from: string; to: string } }
): StrategicSignal[] {
  return findings.slice(0, 10).map((f) => {
    const listedResellers = listed.get(f.productId) ?? 0
    const early = listedResellers <= EMERGING_FEW_RESELLERS
    return {
      id: `discovery:emerging:${f.productId}`,
      domain: "product_discovery",
      priority: early ? "important" : "study",
      kind: "fact",
      title: early
        ? `Produit émergent, encore peu distribué : « ${f.name} » (commandes ${ratioTxt(f.growth)} par jour)`
        : `Produit en accélération : « ${f.name} » (commandes ${ratioTxt(f.growth)} par jour, déjà ${listedResellers} revendeurs)`,
      evidence: [
        { label: `Commandes payées, ${EMERGING_RECENT_DAYS} derniers jours`, value: String(f.recent) },
        { label: `Commandes payées, ${EMERGING_PRIOR_DAYS} jours précédents`, value: String(f.prior) },
        { label: "Évolution du rythme quotidien (produit / marketplace)", value: `${ratioTxt(f.growth)} / ${ratioTxt(f.marketGrowth)}` },
        { label: "Revendeurs qui l'ont vendu (14 jours)", value: String(f.sellingResellers) },
        { label: "Revendeurs qui le proposent", value: String(listedResellers) },
        { label: "Probabilité d'une telle accélération par hasard", value: f.pValue < 1e-6 ? "< 0,0001 %" : `${(f.pValue * 100).toFixed(2).replace(".", ",")} %` },
      ],
      source: { id: "affisell.listings", query: `Order payées (${EMERGING_RECENT_DAYS} j vs ${EMERGING_PRIOR_DAYS} j précédents) par produit, corrigées de la tendance de la marketplace × AffiliateProduct.isListed` },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: f.sellingResellers >= 2 ? "high" : "medium",
      confidenceReason:
        f.sellingResellers >= 2
          ? "Accélération significative (test binomial exact, corrigé du nombre de produits testés et de la tendance générale), observée chez plusieurs revendeurs."
          : "Accélération significative mais portée par un seul revendeur : peut venir de sa propre campagne plutôt que d'une demande générale.",
      recommendedAction: early
        ? "Le proposer aux revendeurs de la même catégorie maintenant (avant qu'il se banalise) ; vérifier d'abord le stock et le délai du fournisseur. Effet mesurable : commandes payées du produit."
        : "Vérifier la capacité du fournisseur et l'absence de signal qualité avant d'en pousser davantage la distribution.",
      link: "/admin/products",
      subjects: [{ type: "product", id: f.productId, label: f.name }],
    }
  })
}
