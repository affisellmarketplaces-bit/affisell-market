import { isValidGtin, normalizeGtin } from "@/lib/listing-compliance/gtin"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * EU Safety Gate (ex-RAPEX) — dangerous non-food products notified by the EU/EEA market-surveillance authorities.
 *
 * Why this source:
 *  - official (European Commission, DG JUST), public, free, no key; the XML export is published for re-use
 *    (Commission re-use policy, Decision 2011/833/EU) — the list file itself says one report is published every Friday;
 *  - directly tied to Affisell's legal exposure: GPSR (EU 2023/988) obliges a marketplace to act on dangerous products,
 *    and most of what is notified is made in China — the AliExpress catalogue's origin.
 *
 * Format (read from the live files by .github/workflows/intelligence-live-sources.yml on 2026-11-17):
 *  - list  : <Safety-Gate><weeklyReport><reference>Report-2026-45</reference><publicationDate>13/11/2026</publicationDate>
 *            … <URL>…/weeklyReport/detail/xml/10000331?language=en&amp;search=…</URL></weeklyReport>…
 *  - report: <notifications><caseNumber>SR/03208/26</caseNumber><publicationDate>10-11-2026</publicationDate>
 *            <reference>(alert URL)</reference><category/><product/><brand/><name/><type_numberOfModel/><barcode/>
 *            <riskType/><danger/><measures/><notifyingCountry/><countryOfOrigin/><level/>…</notifications> (CDATA text)
 *
 * MATCHING — a wrong "your product is dangerous" is as harmful as a miss, so only two kinds of match exist:
 *  1. EXACT GTIN: a VALID barcode of the alert (GS1 check digit) equals a valid GTIN declared on an active product
 *     (compared as GTIN-14) → certain identity of the reference, `critical` for a serious risk;
 *  2. BRAND + MODEL: the product's declared brand equals one of the alert's brands (generic "unknown / no brand" never
 *     counts) AND its declared MPN equals one of the alert's model references (≥ 4 characters with a digit) → probable,
 *     to verify, `important`.
 *  A product name alone NEVER matches ("Children's jacket" would hit thousands of products). Nothing is ever changed
 *  automatically: the action is to verify, then use the recall procedure if confirmed.
 */
export const SAFETY_GATE_LIST_URL = "https://ec.europa.eu/safety-gate-alerts/api/download/weeklyReport/list/xml/en"
/**
 * Rebuilt from the numeric id — a URL read from the file is never fetched as is. The `search` parameter is required by
 * the portal (without it the answer is HTTP 400 — found by the live check on 2026-11-17); same shape as in the list.
 */
export function safetyGateReportUrl(id: string): string {
  if (!/^\d{1,12}$/.test(id)) throw new Error("safety_gate_bad_report_id")
  return `https://ec.europa.eu/safety-gate-alerts/api/download/weeklyReport/detail/xml/${id}?language=en&search=WEB_REPORT%7C:%7C${id},`
}

export type WeeklyReportRef = { reference: string; publishedOn: string; id: string }

export type SafetyGateAlert = {
  caseNumber: string
  publishedOn: string | null
  url: string | null
  category: string
  product: string
  brands: string[]
  name: string
  models: string[]
  /** Valid GTINs only, as GTIN-14. */
  gtins: string[]
  riskTypes: string
  level: string
  measures: string
  notifyingCountry: string
  countryOfOrigin: string
}

const decode = (s: string) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()

function field(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return m ? decode(m[1]!.trim()) : ""
}

/** "13/11/2026" or "10-11-2026" → "2026-11-13". */
function dmyToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!m) return null
  const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`
  return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? null : iso
}

/** Newest first. Ignores entries without a numeric report id. */
export function parseWeeklyReportList(xml: string): WeeklyReportRef[] {
  const out: WeeklyReportRef[] = []
  for (const m of xml.matchAll(/<weeklyReport>([\s\S]*?)<\/weeklyReport>/g)) {
    const block = m[1]!
    const id = field(block, "URL").match(/\/weeklyReport\/detail\/xml\/(\d{1,12})(?:[?#]|$)/)?.[1]
    const publishedOn = dmyToIso(field(block, "publicationDate"))
    if (!id || !publishedOn) continue
    out.push({ reference: field(block, "reference"), publishedOn, id })
  }
  return out.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || Number(b.id) - Number(a.id))
}

const splitList = (s: string) =>
  s
    .split(/[,;/]|\s+\|\s+/)
    .map((x) => x.trim())
    .filter(Boolean)

export function gtin14(raw: string): string | null {
  const g = normalizeGtin(raw)
  return isValidGtin(g) ? g.padStart(14, "0") : null
}

export function parseWeeklyReport(xml: string): SafetyGateAlert[] {
  const out: SafetyGateAlert[] = []
  for (const m of xml.matchAll(/<notifications(?:\s[^>]*)?>([\s\S]*?)<\/notifications>/g)) {
    const b = m[1]!
    const caseNumber = field(b, "caseNumber")
    if (!caseNumber) continue
    const url = field(b, "reference")
    const barcodes = field(b, "barcode")
      .split(/[^\d]+/)
      .map((x) => gtin14(x))
      .filter((x): x is string => Boolean(x))
    out.push({
      caseNumber,
      publishedOn: dmyToIso(field(b, "publicationDate")),
      url: /^https:\/\/ec\.europa\.eu\/safety-gate-alerts\//.test(url) ? url : null,
      category: field(b, "category"),
      product: field(b, "product"),
      brands: splitList(field(b, "brand")),
      name: field(b, "name"),
      models: splitList(field(b, "type_numberOfModel")),
      gtins: [...new Set(barcodes)],
      riskTypes: field(b, "riskType"),
      level: field(b, "level"),
      measures: field(b, "measures"),
      notifyingCountry: field(b, "notifyingCountry"),
      countryOfOrigin: field(b, "countryOfOrigin"),
    })
  }
  return out
}

// ── matching ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const brandKey = (raw: string) =>
  raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Words that name no brand at all — never a basis for a match. */
const GENERIC_BRANDS = new Set(
  ["", "unknown", "no brand", "nobrand", "none", "n/a", "na", "unbranded", "generic", "brand", "sans marque", "inconnu", "inconnue", "aucune", "-"].map(brandKey)
)

export function normalizeBrand(raw: string): string {
  const b = brandKey(raw)
  return GENERIC_BRANDS.has(b) || /^other\b/.test(b) ? "" : b
}

/** Model / MPN, letters and digits only; "" when too weak to identify anything (< 4 chars or no digit). */
export function normalizeModel(raw: string): string {
  const m = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return m.length >= 4 && /\d/.test(m) ? m : ""
}

export type CatalogIdentity = { productId: string; name: string; gtin: string | null; brand: string | null; mpn: string | null }

export type SafetyGateMatch = {
  alert: SafetyGateAlert
  productId: string
  productName: string
  kind: "exact_gtin" | "brand_model"
  matchedOn: string
}

export function matchSafetyGateAlerts(alerts: SafetyGateAlert[], catalog: CatalogIdentity[]): SafetyGateMatch[] {
  const byGtin = new Map<string, CatalogIdentity[]>()
  const byBrandModel = new Map<string, CatalogIdentity[]>()
  for (const p of catalog) {
    const g = p.gtin ? gtin14(p.gtin) : null
    if (g) byGtin.set(g, [...(byGtin.get(g) ?? []), p])
    const brand = p.brand ? normalizeBrand(p.brand) : ""
    const model = p.mpn ? normalizeModel(p.mpn) : ""
    if (brand && model) byBrandModel.set(`${brand}|${model}`, [...(byBrandModel.get(`${brand}|${model}`) ?? []), p])
  }
  const out: SafetyGateMatch[] = []
  for (const alert of alerts) {
    const seen = new Set<string>()
    for (const g of alert.gtins) {
      for (const p of byGtin.get(g) ?? []) {
        if (seen.has(p.productId)) continue
        seen.add(p.productId)
        out.push({ alert, productId: p.productId, productName: p.name, kind: "exact_gtin", matchedOn: g.startsWith("0") ? g.slice(1) : g })
      }
    }
    const brands = alert.brands.map(normalizeBrand).filter(Boolean)
    const models = alert.models.map(normalizeModel).filter(Boolean)
    for (const b of brands) {
      for (const mo of models) {
        for (const p of byBrandModel.get(`${b}|${mo}`) ?? []) {
          if (seen.has(p.productId)) continue
          seen.add(p.productId)
          out.push({ alert, productId: p.productId, productName: p.name, kind: "brand_model", matchedOn: `${b} / ${mo}` })
        }
      }
    }
  }
  return out
}

// ── signals ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export const SAFETY_GATE_LOW_COVERAGE_BPS = 5000

export function safetyGateSignals(
  input: {
    reports: WeeklyReportRef[]
    alerts: SafetyGateAlert[]
    matches: SafetyGateMatch[]
    coverage: { activeProducts: number; withValidGtin: number; withBrandAndModel: number }
  },
  ctx: { observedAt: string }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  const from = input.reports[input.reports.length - 1]?.publishedOn
  const to = input.reports[0]?.publishedOn
  const window = from && to ? { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` } : null
  const reportsLabel = input.reports.map((r) => r.reference).join(", ")

  for (const m of input.matches) {
    const serious = /serious/i.test(m.alert.level)
    const exact = m.kind === "exact_gtin"
    out.push({
      id: `risk:safety-gate:${m.alert.caseNumber}:${m.productId}`,
      domain: "regulatory_risk",
      priority: exact && serious ? "critical" : "important",
      kind: exact ? "fact" : "hypothesis",
      title: exact
        ? `Produit signalé dangereux dans l'UE (Safety Gate ${m.alert.caseNumber}) : « ${m.productName} » — même code-barres`
        : `Produit peut-être signalé dans l'UE (Safety Gate ${m.alert.caseNumber}) : « ${m.productName} » — même marque et modèle`,
      evidence: [
        { label: exact ? "Code-barres identique" : "Marque / modèle identiques", value: m.matchedOn },
        { label: "Produit signalé", value: [m.alert.product, m.alert.name].filter(Boolean).join(" — ") || "—" },
        { label: "Risque", value: [m.alert.level, m.alert.riskTypes].filter(Boolean).join(" · ") || "—" },
        { label: "Mesure", value: m.alert.measures.slice(0, 200) || "—" },
        { label: "Pays notifiant / origine", value: `${m.alert.notifyingCountry || "—"} / ${m.alert.countryOfOrigin || "—"}` },
        { label: "Alerte officielle", value: m.alert.url ?? m.alert.caseNumber },
      ],
      source: { id: "eu.safety_gate", query: `Rapports hebdomadaires ${reportsLabel} × identifiants déclarés du catalogue (GTIN, marque + référence)` },
      observedAt: ctx.observedAt,
      window,
      confidence: exact ? "high" : "medium",
      confidenceReason: exact
        ? "Code-barres GS1 valide identique : c'est la même référence. Le lot ou la taille concernés restent à vérifier sur l'alerte."
        : "Même marque et même référence modèle déclarées, sans code-barres commun : correspondance probable, à confirmer sur l'alerte (photos, description).",
      recommendedAction: exact
        ? "Ouvrir l'alerte officielle, vérifier lot et variante, puis suspendre la fiche et lancer la procédure de rappel si le produit est concerné. Rien n'a été modifié automatiquement."
        : "Comparer l'alerte (photos, description, modèle) avec la fiche ; si c'est le même produit, appliquer la procédure de rappel. Rien n'a été modifié automatiquement.",
      link: `/admin/products`,
    })
  }

  // Honesty about what the check can see: matching is only as good as the identifiers suppliers declared.
  const { activeProducts, withValidGtin, withBrandAndModel } = input.coverage
  if (activeProducts > 0) {
    const gtinBps = Math.round((withValidGtin / activeProducts) * 10_000)
    if (gtinBps < SAFETY_GATE_LOW_COVERAGE_BPS) {
      out.push({
        id: `risk:safety-gate:coverage:${to ?? "none"}`,
        domain: "regulatory_risk",
        priority: "study",
        kind: "fact",
        title: `Contrôle Safety Gate partiel : ${(gtinBps / 100).toFixed(0)} % des produits actifs ont un code-barres valide`,
        evidence: [
          { label: "Alertes lues", value: `${input.alerts.length} (${reportsLabel || "—"})` },
          { label: "Produits actifs", value: String(activeProducts) },
          { label: "Avec un GTIN valide", value: String(withValidGtin) },
          { label: "Avec marque + référence modèle", value: String(withBrandAndModel) },
          { label: "Correspondances trouvées", value: String(input.matches.length) },
        ],
        source: { id: "eu.safety_gate", query: "Couverture des identifiants (ProductAttribute ean / brand / mpn) des produits actifs" },
        observedAt: ctx.observedAt,
        window,
        confidence: "high",
        confidenceReason: "Les autres produits ne peuvent pas être rapprochés de façon fiable : un nom seul ne prouve rien.",
        recommendedAction: "Demander aux fournisseurs de déclarer le GTIN (ou marque + référence) — c'est aussi une exigence de traçabilité GPSR.",
        link: "/admin/products",
      })
    }
  }
  return out
}
