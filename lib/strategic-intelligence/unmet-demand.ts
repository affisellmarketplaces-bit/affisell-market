import { sanitizeSearchQuery } from "@/lib/events/sanitize"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — demand that Affisell does NOT serve yet (pure). Growth that is invisible in sales, because
 * nothing was sold: people asked and found nothing.
 *
 * Two internal, already-recorded sources (read-only):
 *  1. Searches with NO catalogue result — `SearchHistory` rows written by the shopping assistant for signed-in users,
 *     `productId` null = the search returned nothing. Free text, so every query goes through the event spine's own
 *     sanitizer (`sanitizeSearchQuery`: e-mails, URLs, phone/card/IBAN numbers, postal codes, order/tracking tokens and
 *     street addresses are DROPPED whole). A query is shown only when ≥ MIN_DISTINCT_USERS different people typed it
 *     (k-anonymity: one person's search is never displayed) and most of its occurrences found nothing.
 *  2. Reseller product REQUESTS nobody answered — `ProductRequest` open for ≥ REQUEST_MIN_AGE_DAYS with no quote, per
 *     category, from ≥ 2 resellers; and requests whose every quote is above the reseller's target price (the supply
 *     exists but not at a price that sells). E-mails are never read.
 *
 * What it is NOT: market size. It is what Affisell's own users asked for — a lead for supplier recruitment and new
 * categories, to be checked (is there a supplier, a margin, a compliant product?) before anything is built.
 */
export const UNMET_WINDOW_DAYS = 90
export const MIN_DISTINCT_USERS = 3
export const MIN_ZERO_RESULT_SHARE = 0.5
export const REQUEST_MIN_AGE_DAYS = 7
export const REQUEST_MIN_COUNT = 3
export const REQUEST_MIN_RESELLERS = 2

export type SearchRow = { userId: string | null; query: string; productId: string | null }

export type UnmetQuery = { query: string; users: number; searches: number; zeroResult: number }

export function unmetSearches(rows: SearchRow[]): UnmetQuery[] {
  const by = new Map<string, { users: Set<string>; searches: number; zero: number }>()
  for (const r of rows) {
    if (!r.userId) continue
    const q = sanitizeSearchQuery(r.query)
    if (!q || q.length < 3) continue
    const e = by.get(q) ?? { users: new Set<string>(), searches: 0, zero: 0 }
    e.users.add(r.userId)
    e.searches++
    if (!r.productId) e.zero++
    by.set(q, e)
  }
  return [...by.entries()]
    .filter(([, e]) => e.users.size >= MIN_DISTINCT_USERS && e.zero / e.searches >= MIN_ZERO_RESULT_SHARE)
    .map(([query, e]) => ({ query, users: e.users.size, searches: e.searches, zeroResult: e.zero }))
    .sort((a, b) => b.users - a.users || b.zeroResult - a.zeroResult)
}

export type RequestRow = {
  resellerId: string
  title: string
  category: string
  quotesCount: number
  targetPriceEur: number | null
  createdAt: Date
  status: string
  quotePricesEur: number[]
}

export type UnmetCategory = { category: string; requests: number; resellers: number; examples: string[] }
export type PriceGapCategory = { category: string; requests: number; medianGapPct: number; examples: string[] }

const cleanTitle = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 80)

export function unansweredRequests(rows: RequestRow[], now: Date): UnmetCategory[] {
  const minAge = now.getTime() - REQUEST_MIN_AGE_DAYS * 86_400_000
  const by = new Map<string, { n: number; resellers: Set<string>; examples: string[] }>()
  for (const r of rows) {
    if (r.status !== "open" || r.quotesCount > 0 || r.createdAt.getTime() > minAge) continue
    const c = (r.category || "general").trim().toLowerCase()
    const e = by.get(c) ?? { n: 0, resellers: new Set<string>(), examples: [] }
    e.n++
    e.resellers.add(r.resellerId)
    if (e.examples.length < 3) e.examples.push(cleanTitle(r.title))
    by.set(c, e)
  }
  return [...by.entries()]
    .filter(([, e]) => e.n >= REQUEST_MIN_COUNT && e.resellers.size >= REQUEST_MIN_RESELLERS)
    .map(([category, e]) => ({ category, requests: e.n, resellers: e.resellers.size, examples: e.examples }))
    .sort((a, b) => b.resellers - a.resellers || b.requests - a.requests)
}

export function priceGapRequests(rows: RequestRow[]): PriceGapCategory[] {
  const by = new Map<string, { gaps: number[]; examples: string[] }>()
  for (const r of rows) {
    if (r.targetPriceEur == null || !(r.targetPriceEur > 0) || r.quotePricesEur.length === 0) continue
    const best = Math.min(...r.quotePricesEur)
    if (!(best > r.targetPriceEur)) continue
    const c = (r.category || "general").trim().toLowerCase()
    const e = by.get(c) ?? { gaps: [], examples: [] }
    e.gaps.push((best - r.targetPriceEur) / r.targetPriceEur)
    if (e.examples.length < 3) e.examples.push(cleanTitle(r.title))
    by.set(c, e)
  }
  return [...by.entries()]
    .filter(([, e]) => e.gaps.length >= REQUEST_MIN_COUNT)
    .map(([category, e]) => {
      const s = [...e.gaps].sort((a, b) => a - b)
      return { category, requests: s.length, medianGapPct: Math.round(s[Math.floor((s.length - 1) / 2)]! * 100), examples: e.examples }
    })
    .sort((a, b) => b.requests - a.requests)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x"

export function unmetDemandSignals(
  input: { searches: UnmetQuery[]; unanswered: UnmetCategory[]; priceGaps: PriceGapCategory[]; searchRowsRead: number },
  ctx: { observedAt: string; window: { from: string; to: string } }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  for (const q of input.searches.slice(0, 10)) {
    out.push({
      id: `discovery:unmet-search:${slug(q.query)}`,
      domain: "product_discovery",
      priority: q.users >= 10 ? "important" : "study",
      kind: "fact",
      title: `Recherché sans résultat par ${q.users} personnes : « ${q.query} »`,
      evidence: [
        { label: "Personnes distinctes", value: String(q.users) },
        { label: "Recherches / sans résultat", value: `${q.searches} / ${q.zeroResult}` },
      ],
      source: { id: "affisell.search", query: `SearchHistory (assistant, comptes connectés, ${UNMET_WINDOW_DAYS} j), requêtes filtrées (données personnelles écartées), ≥ ${MIN_DISTINCT_USERS} personnes` },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: q.users >= 10 ? "high" : "medium",
      confidenceReason: "Demande exprimée par des utilisateurs d'Affisell et restée sans réponse du catalogue ; ce n'est pas une taille de marché.",
      recommendedAction: "Vérifier s'il existe un fournisseur, une marge et un produit conforme ; si oui, recruter ce fournisseur ou l'ajouter au catalogue.",
      link: "/admin/products",
    })
  }
  for (const c of input.unanswered.slice(0, 5)) {
    out.push({
      id: `discovery:unanswered-requests:${slug(c.category)}`,
      domain: "supplier",
      priority: c.resellers >= 5 ? "important" : "study",
      kind: "fact",
      title: `${c.requests} demande(s) de produits sans aucun devis, catégorie « ${c.category} » (${c.resellers} revendeurs)`,
      evidence: [
        { label: "Demandes ouvertes sans devis (≥ 7 jours)", value: String(c.requests) },
        { label: "Revendeurs distincts", value: String(c.resellers) },
        { label: "Exemples", value: c.examples.join(" · ") },
      ],
      source: { id: "affisell.product_requests", query: "ProductRequest ouvertes, sans devis, créées il y a ≥ 7 jours, par catégorie" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "high",
      confidenceReason: "Demandes déposées par des revendeurs et qu'aucun fournisseur actuel n'a chiffrées.",
      recommendedAction: "Recruter des fournisseurs pour cette catégorie (les demandes disent quoi chercher) ; c'est une offre manquante, pas encore un marché validé.",
      link: null,
    })
  }
  for (const g of input.priceGaps.slice(0, 5)) {
    out.push({
      id: `discovery:request-price-gap:${slug(g.category)}`,
      domain: "supplier",
      priority: "study",
      kind: "fact",
      title: `Devis trop chers pour le prix cible des revendeurs, catégorie « ${g.category} » (écart médian +${g.medianGapPct} %)`,
      evidence: [
        { label: "Demandes dont le meilleur devis dépasse le prix cible", value: String(g.requests) },
        { label: "Écart médian", value: `+${g.medianGapPct} %` },
        { label: "Exemples", value: g.examples.join(" · ") },
      ],
      source: { id: "affisell.product_requests", query: "ProductRequest.targetPrice × min(ProductQuote.price)" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "medium",
      confidenceReason: "Prix cible déclaré par le revendeur ; le devis est un prix unitaire fournisseur (quantité minimale et livraison non comparées).",
      recommendedAction: "Chercher une source moins chère pour ces produits (autre fournisseur, autre origine) : la demande existe mais pas au prix proposé.",
      link: null,
    })
  }
  return out
}
