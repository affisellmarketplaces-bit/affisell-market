import { isoWeek } from "@/lib/strategic-intelligence/detectors"
import type { SafetyGateAlert } from "@/lib/strategic-intelligence/external/safety-gate"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * Safety Gate × Affisell catalogue × Affisell sales, by CATEGORY — where the EU is finding dangerous products, how much
 * Affisell sells there, and how much of that it can actually check (valid GTIN).
 *
 * The bridge between Safety Gate's ~30 product categories and Affisell's categories (Google Product Taxonomy) is a
 * hand-written correspondence to the taxonomy's ROOT ids (prisma/taxonomy-en.txt). It is approximate on purpose
 * (coarse roots, an "Electrical appliances" alert may be electronics or a household appliance), so every signal is an
 * ESTIMATE and says so. A Safety Gate category without a defensible root (chemical products, pyrotechnics, "other") is
 * left unmapped rather than guessed.
 */
export const SAFETY_GATE_CATEGORY_ROOTS: Record<string, number[]> = {
  toys: [1239],
  "childcare articles and children's equipment": [537],
  "clothing, textiles and fashion items": [166],
  jewellery: [166],
  cosmetics: [469],
  "electrical appliances and equipment": [222, 536],
  "lighting equipment": [536],
  "lighting chains": [536],
  furniture: [436],
  "kitchen/cooking accessories": [536],
  "decorative articles": [536],
  "hobby/sports equipment": [988],
  "protective equipment": [988, 111],
  "communication and media equipment": [222],
  "laser pointers": [222],
  gadgets: [222, 1239],
  "hand tools": [632],
  machinery: [632],
  "construction products": [632],
  stationery: [922],
  "motor vehicles": [888],
  "recreational crafts": [988],
}

export const ROOT_LABELS: Record<number, string> = {
  1: "Animaux", 166: "Mode et accessoires", 8: "Arts et loisirs", 537: "Bébé et petite enfance", 111: "Professionnel",
  141: "Photo et optique", 222: "Électronique", 412: "Alimentation", 436: "Meubles", 632: "Bricolage", 469: "Santé et beauté",
  536: "Maison et jardin", 5181: "Bagagerie", 772: "Adulte", 783: "Médias", 922: "Fournitures de bureau",
  5605: "Religion et cérémonie", 2092: "Logiciels", 988: "Sport", 1239: "Jeux et jouets", 888: "Véhicules",
}

export const normaliseSgCategory = (c: string) => c.trim().toLowerCase().replace(/\s+/g, " ")

export type RootExposure = { activeProducts: number; withValidGtin: number; units30: number }

export type CategoryAlertStats = {
  category: string
  roots: number[] | null
  alerts: number
  serious: number
  topRisks: Array<[string, number]>
  chinaShareBps: number
}

export function aggregateAlertsByCategory(alerts: SafetyGateAlert[]): CategoryAlertStats[] {
  const by = new Map<string, SafetyGateAlert[]>()
  for (const a of alerts) {
    const k = normaliseSgCategory(a.category || "other")
    by.set(k, [...(by.get(k) ?? []), a])
  }
  return [...by.entries()].map(([category, list]) => {
    const risks = new Map<string, number>()
    for (const a of list) for (const r of a.riskTypes.split(/,\s*/).map((x) => x.trim()).filter(Boolean)) risks.set(r, (risks.get(r) ?? 0) + 1)
    const china = list.filter((a) => /china/i.test(a.countryOfOrigin)).length
    return {
      category,
      roots: SAFETY_GATE_CATEGORY_ROOTS[category] ?? null,
      alerts: list.length,
      serious: list.filter((a) => /serious/i.test(a.level)).length,
      topRisks: [...risks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      chinaShareBps: Math.round((china / list.length) * 10_000),
    }
  })
}

export const EXPOSURE_MIN_SERIOUS = 5
export const EXPOSURE_MIN_UNITS = 10
export const EXPOSURE_LOW_GTIN_BPS = 5000

const pct = (bps: number) => `${Math.round(bps / 100)} %`

export function categoryExposureSignals(
  input: { stats: CategoryAlertStats[]; exposure: Map<number, RootExposure>; reportsLabel: string; weeks: number },
  ctx: { observedAt: string; window: { from: string; to: string } | null }
): StrategicSignal[] {
  const week = isoWeek(new Date(ctx.observedAt))
  const rows = input.stats
    .filter((s) => s.roots)
    .map((s) => {
      const e = s.roots!.reduce(
        (acc, r) => {
          const x = input.exposure.get(r)
          return x ? { activeProducts: acc.activeProducts + x.activeProducts, withValidGtin: acc.withValidGtin + x.withValidGtin, units30: acc.units30 + x.units30 } : acc
        },
        { activeProducts: 0, withValidGtin: 0, units30: 0 }
      )
      return { s, e }
    })
    .filter(({ e }) => e.activeProducts > 0)
    .sort((a, b) => b.s.serious * (b.e.units30 + 1) - a.s.serious * (a.e.units30 + 1))
    .slice(0, 5)

  return rows.map(({ s, e }) => {
    const gtinBps = e.activeProducts > 0 ? Math.round((e.withValidGtin / e.activeProducts) * 10_000) : 0
    const important = s.serious >= EXPOSURE_MIN_SERIOUS && e.units30 >= EXPOSURE_MIN_UNITS && gtinBps < EXPOSURE_LOW_GTIN_BPS
    const roots = s.roots!.map((r) => ROOT_LABELS[r] ?? String(r)).join(" + ")
    return {
      id: `risk:safety-gate-category:${s.category.replace(/[^a-z0-9]+/g, "-")}:${week}`,
      domain: "regulatory_risk" as const,
      priority: important ? ("important" as const) : ("study" as const),
      kind: "estimate" as const,
      title: `Produits signalés dangereux dans l'UE : « ${s.category} » (${s.serious} risques graves en ${input.weeks} semaines) — Affisell y vend ${e.units30} unité(s)/30 j`,
      evidence: [
        { label: `Alertes Safety Gate (${input.weeks} semaines)`, value: `${s.alerts} dont ${s.serious} risque grave` },
        { label: "Risques les plus fréquents", value: s.topRisks.map(([r, n]) => `${r} (${n})`).join(", ") || "—" },
        { label: "Origine Chine", value: pct(s.chinaShareBps) },
        { label: `Catalogue Affisell correspondant (${roots})`, value: `${e.activeProducts} produit(s) actif(s), ${e.units30} unité(s) vendue(s) en 30 j` },
        { label: "Produits contrôlables par code-barres", value: `${e.withValidGtin} (${pct(gtinBps)})` },
      ],
      source: { id: "eu.safety_gate", query: `Rapports ${input.reportsLabel} × catégories racines Google (correspondance manuelle) × commandes payées 30 j` },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "medium" as const,
      confidenceReason:
        "Les chiffres UE et Affisell sont exacts ; la correspondance entre catégories Safety Gate et catégories Affisell est approximative (catégories racines).",
      recommendedAction: important
        ? "Contrôler en priorité les produits de cette catégorie : code-barres, fabricant et personne responsable UE (GPSR), puis les comparer aux alertes."
        : "Surveiller : demander les codes-barres aux fournisseurs de cette catégorie pour que le contrôle automatique les couvre.",
      link: "/admin/products",
    }
  })
}
