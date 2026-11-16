import type { IntelligenceDomain } from "@/lib/strategic-intelligence/types"

/**
 * Which sources the cockpit can REALLY read today (pure; reads only whether an environment variable is set — never its
 * value). "connected" = Affisell's own database, always read. "configured" = credentials are present but nothing proves
 * the source answers (the cockpit does not call it in step 1). "not_connected" = no credentials / no code: the domain
 * shows that gap instead of pretending to watch it.
 */
export type SourceStatus = "connected" | "configured" | "not_connected"

export type IntelligenceSource = {
  id: string
  domain: IntelligenceDomain
  label: string
  kind: "internal" | "official_api" | "search_api" | "fixture"
  status: SourceStatus
  note: string
}

type SourceSpec = Omit<IntelligenceSource, "status"> & { env?: string[]; always?: boolean }

const SPECS: SourceSpec[] = [
  { id: "affisell.orders", domain: "commercial", label: "Commandes payées, remboursements, litiges (base Affisell)", kind: "internal", always: true, note: "Lecture seule de la base de données." },
  { id: "affisell.orders.categories", domain: "market_observatory", label: "Demande interne par catégorie (base Affisell)", kind: "internal", always: true, note: "Demande observée sur Affisell uniquement — pas le marché mondial." },
  { id: "affisell.listings", domain: "product_discovery", label: "Annonces revendeurs et ventes par produit (base Affisell)", kind: "internal", always: true, note: "Lecture seule." },
  { id: "affisell.price_history", domain: "supplier", label: "Historique des prix fournisseurs (déclencheur ProductPriceHistory)", kind: "internal", always: true, note: "Vide tant que la migration 20261116200000 n'est pas appliquée." },
  { id: "affisell.delivery_stats", domain: "supplier", label: "Délais de livraison attestés par fournisseur", kind: "internal", always: true, note: "Calculés par le cron refresh-supplier-delivery-stats." },
  { id: "affisell.profit_alerts", domain: "commercial", label: "Alertes de rentabilité des revendeurs", kind: "internal", always: true, note: "Vide tant que la migration 20261117120000 n'est pas appliquée." },
  { id: "affisell.sentinel", domain: "regulatory_risk", label: "Signaux opérationnels Sentinel (OpsSignal)", kind: "internal", always: true, note: "Repris tels quels, pas dupliqués." },
  { id: "affisell.audit.unallocated", domain: "regulatory_risk", label: "Lignes payées sans commande (AuditLog)", kind: "internal", always: true, note: "Lecture seule." },
  { id: "serper.google_search", domain: "market_observatory", label: "Recherche Google via Serper (Radar trends-watcher)", kind: "search_api", env: ["SERPER_API_KEY"], note: "Service payant à l'appel ; non interrogé par le poste de pilotage à l'étape 1." },
  { id: "tiktok_shop.oauth", domain: "competitive", label: "TikTok Shop (connecteur Radar, OAuth par compte)", kind: "official_api", env: ["TIKTOK_SHOP_APP_KEY"], note: "Donne les données du compte connecté, pas celles des concurrents." },
  { id: "amazon.sp_api", domain: "competitive", label: "Amazon SP-API (connecteur Radar)", kind: "official_api", env: ["AMAZON_LWA_CLIENT_ID", "AMAZON_SP_API_CLIENT_ID"], note: "Données du vendeur connecté uniquement." },
  { id: "market_intelligence.fixtures", domain: "market_observatory", label: "« Market intelligence » (cron sync-market-intelligence)", kind: "fixture", note: "Trois fiches écrites à la main — ce ne sont PAS des données de marché ; jamais utilisées comme signal." },
  { id: "innovation.none", domain: "innovation", label: "Veille technologique", kind: "official_api", note: "Aucune source connectée (flux de publications, changelogs, dépôts publics à choisir)." },
  { id: "regulatory.none", domain: "regulatory_risk", label: "Veille réglementaire (UE, France)", kind: "official_api", note: "Aucune source connectée (EUR-Lex, Journal officiel : flux publics à brancher)." },
]

export function listIntelligenceSources(env: Record<string, string | undefined> = process.env): IntelligenceSource[] {
  return SPECS.map(({ env: names, always, ...s }) => {
    let status: SourceStatus = "not_connected"
    if (always) status = "connected"
    else if (s.kind !== "fixture" && names?.some((n) => Boolean(env[n]?.trim()))) status = "configured"
    return { ...s, status }
  })
}

/** Best status per domain ("strategic_evolution" has no source of its own: it is derived from the others). */
export function domainCoverage(sources: IntelligenceSource[]): Partial<Record<IntelligenceDomain, SourceStatus>> {
  const order: Record<SourceStatus, number> = { connected: 2, configured: 1, not_connected: 0 }
  const out: Partial<Record<IntelligenceDomain, SourceStatus>> = {}
  for (const s of sources) {
    const cur = out[s.domain]
    if (!cur || order[s.status] > order[cur]) out[s.domain] = s.status
  }
  return out
}
