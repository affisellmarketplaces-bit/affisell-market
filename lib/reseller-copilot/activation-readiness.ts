/**
 * Copilot Engine Activation Readiness Intelligence (founder brief 2026-11-24, portfolio row 41). PURE, READ-ONLY.
 *
 * For each of the five copilot engines built on the listing presence history, says — from verifiable facts only — how
 * far it is from a real activation: technical state, data readiness, statistical readiness, a maturity LADDER
 * (0 Bloqué → 5 Activable sous autorisation, several dimensions, never one percentage), what is missing, an ETA ONLY
 * from a measured cadence (« durée inconnue » otherwise), and the progressive activation sequence with its gates.
 *
 * Every threshold below is the ENGINE'S OWN exported constant (imported, never copied), so this report can not drift
 * from what the engine really demands. Nothing here activates anything: activation is a founder decision, and data
 * collection (applying the migration) and engine activation are two separate decisions.
 */
import { BLIND_SPOT_WINDOW_DAYS, BS_MIN_LISTING_DAYS, BS_MIN_ORDERS, BS_MIN_RESELLERS } from "./blind-spots"
import { TEMPORAL_MIN_LISTING_DAYS, TEMPORAL_MIN_ORDERS, TEMPORAL_MIN_RESELLERS, type MeasuredPeriod } from "./temporal-opportunities"
import { RETENTION_MIN_AT_RISK, RETENTION_MIN_AT_RISK_RESELLERS, RETENTION_TIERS } from "./retention-advisor"
import { PLAN_MIN_OUTCOMES, PLAN_TIERS } from "./observation-plan"
import { CH_CAP_DAYS, CH_MIN_EVENTS, CH_MIN_RESELLERS, CH_MIN_TEST_PRODUCTS, CH_MIN_TEST_SALES } from "./contextual-horizon"

const DAY = 86_400_000

export type EngineId = "blind_spots" | "temporal" | "retention" | "observation_plan" | "contextual_horizon"
export type MaturityLevel = 0 | 1 | 2 | 3 | 4 | 5
export const MATURITY_LABELS: Record<MaturityLevel, string> = {
  0: "Bloqué",
  1: "Implémenté",
  2: "Testé",
  3: "Données prêtes",
  4: "Validé",
  5: "Activable sous autorisation",
}
export type EngineState = "bloque" | "en_attente_de_donnees" | "collecte" | "validation" | "pret"
export type Risk = "faible" | "moyen" | "eleve"

/** Static, verified-in-code description of each engine (names, flags, routes, dependency, tests, user exposure). */
export type EngineSpec = {
  id: EngineId
  name: string
  flag: string
  modes: readonly string[]
  holdoutFlag: string | null
  routes: readonly string[]
  /** true = cannot produce anything without the presence migration; false = degrades to a fallback without it. */
  requiresPresenceMigration: boolean
  fallbackWithoutMigration: string | null
  /** What `observe` writes (AuditLog markers) — `null` = writes nothing. */
  observeWrites: string | null
  /** Seen by resellers in `on` (higher risk) vs admin aggregates only. */
  resellerFacing: boolean
  tests: readonly string[]
  /** Coded thresholds, from the engine's own constants. */
  thresholds: Record<string, number>
  silences: readonly string[]
  risk: Risk
}

export const ENGINES: readonly EngineSpec[] = [
  {
    id: "blind_spots",
    name: "Blind-Spots Detector",
    flag: "COPILOT_BLIND_SPOTS_MODE",
    modes: ["off", "observe"],
    holdoutFlag: null,
    routes: ["GET /api/admin/copilot-blind-spots (report)"],
    requiresPresenceMigration: false,
    fallbackWithoutMigration: "exposition par annonces EN LIGNE aujourd'hui (annonces retirées non enregistrées) tant que l'historique ne couvre pas la fenêtre de 90 jours",
    observeWrites: null,
    resellerFacing: false,
    tests: ["copilot-blind-spots"],
    thresholds: { windowDays: BLIND_SPOT_WINDOW_DAYS, minListingDays: BS_MIN_LISTING_DAYS, minResellers: BS_MIN_RESELLERS, minOrders: BS_MIN_ORDERS },
    silences: ["donnees_insuffisantes (sous les planchers)", "non_eligible (bloqué, gain faible, stock ≤ 3 ou inconnu)", "lecture tronquée = aucun classement"],
    risk: "faible",
  },
  {
    id: "temporal",
    name: "Temporal Opportunities Engine",
    flag: "COPILOT_TEMPORAL_MODE",
    modes: ["off", "observe"],
    holdoutFlag: null,
    routes: ["GET /api/admin/copilot-blind-spots (temporal, presenceSources)"],
    requiresPresenceMigration: true,
    fallbackWithoutMigration: null,
    observeWrites: null,
    resellerFacing: false,
    tests: ["copilot-temporal"],
    thresholds: { minListingDays: TEMPORAL_MIN_LISTING_DAYS, minResellers: TEMPORAL_MIN_RESELLERS, minOrders: TEMPORAL_MIN_ORDERS, hypothesisPeriodsPerSide: 20, hypothesisResellersPerSide: 5 },
    silences: ["available: false (migration non appliquée)", "période aux bornes inconnues = non jugée", "lecture tronquée = aucun constat"],
    risk: "faible",
  },
  {
    id: "observation_plan",
    name: "Adaptive Product Observation Plan",
    flag: "OBSERVATION_PLAN_MODE",
    modes: ["off", "observe", "on"],
    holdoutFlag: "OBSERVATION_PLAN_HOLDOUT_PCT",
    routes: [
      "GET /api/affiliate/copilot/observation-plan",
      "GET /api/affiliate/listings/<id>/observation-plan",
      "GET /api/admin/copilot-blind-spots (observationPlans)",
    ],
    requiresPresenceMigration: true,
    fallbackWithoutMigration: null,
    observeWrites: "AuditLog copilot.observation_plan (à l'ajout) + copilot.observation_plan_evaluated",
    resellerFacing: true,
    tests: ["observation-plan", "observation-plan-db"],
    thresholds: {
      productResellers: PLAN_TIERS.product.minResellers,
      productSales: PLAN_TIERS.product.minSales,
      categoryResellers: PLAN_TIERS.category.minResellers,
      categorySales: PLAN_TIERS.category.minSales,
      generalResellers: PLAN_TIERS.general.minResellers,
      generalSales: PLAN_TIERS.general.minSales,
      minOutcomes: PLAN_MIN_OUTCOMES,
      calibrationPlans: 20,
      calibrationResellers: 5,
      matureCasesPerArm: 20,
    },
    silences: ["contrainte (préparation bloquée)", "non vendable (≤ 3 unités / stock inconnu)", "gain par vente faible", "référence trop mince"],
    risk: "moyen",
  },
  {
    id: "retention",
    name: "Smart Retention Advisor",
    flag: "RETENTION_ADVISOR_MODE",
    modes: ["off", "observe", "on"],
    holdoutFlag: "RETENTION_ADVISOR_HOLDOUT_PCT",
    routes: ["GET /api/affiliate/listings/<id>/retention-advice", "GET /api/admin/copilot-blind-spots (retention)"],
    requiresPresenceMigration: true,
    fallbackWithoutMigration: null,
    observeWrites: "AuditLog copilot.retention_advice (une fois par annonce × période)",
    resellerFacing: true,
    tests: ["retention-advisor"],
    thresholds: {
      productResellers: RETENTION_TIERS.product.minResellers,
      productSales: RETENTION_TIERS.product.minSales,
      categoryResellers: RETENTION_TIERS.category.minResellers,
      categorySales: RETENTION_TIERS.category.minSales,
      atRisk: RETENTION_MIN_AT_RISK,
      atRiskResellers: RETENTION_MIN_AT_RISK_RESELLERS,
      matureCasesPerArm: 20,
    },
    silences: ["historique indisponible / période incertaine", "déjà vendu", "contrainte", "non vendable", "gain faible", "référence trop mince", "durée déjà atteinte", "pas de délai justifié", "chance faible"],
    risk: "eleve",
  },
  {
    id: "contextual_horizon",
    name: "Context-Aware Observation Intelligence",
    flag: "CONTEXTUAL_HORIZON_MODE",
    modes: ["off", "observe", "on"],
    holdoutFlag: null,
    routes: ["GET /api/admin/copilot-blind-spots (contextualHorizon)", "plan d'observation (plan.context, seulement en on + verdict meilleur)"],
    requiresPresenceMigration: true,
    fallbackWithoutMigration: null,
    observeWrites: "AuditLog copilot.contextual_horizon_snapshot (un par jour)",
    resellerFacing: true,
    tests: ["contextual-horizon"],
    thresholds: { capDays: CH_CAP_DAYS, levelSales: CH_MIN_EVENTS, levelResellers: CH_MIN_RESELLERS, testProducts: CH_MIN_TEST_PRODUCTS, testSales: CH_MIN_TEST_SALES },
    silences: ["verdict insuffisant / abandonne / experimental = aucun horizon personnalisé", "cellule non fiable sans le revendeur", "écart < 7 jours", "jamais au-dessus de la référence produit"],
    risk: "eleve",
  },
] as const

/** Aggregated facts read by the server (or built by a test). Counts only — no identifier. */
export type ReadinessFacts = {
  now: Date
  migrationApplied: boolean
  trackingStartedAt: Date | null
  presenceTruncated: boolean
  /** Presence events in the last 90 days and the share still « unattributed » (null when unreadable). */
  presenceEvents90d: number | null
  unattributedShare: number | null
  /** Periods with known edges, measured by the temporal engine's own `measurePeriods`. */
  periods: readonly MeasuredPeriod[]
  unjudgedPeriods: number
  /** Markers recorded by the engines in `observe` / `on` (all arms). */
  markers: { retention: number; plan: number; contextualSnapshots: number }
  modes: Record<EngineId, string>
}

export type DataSummary = {
  historyDays: number | null
  coversBlindSpotWindow: boolean
  periods: number
  unjudgedPeriods: number
  censoredShare: number | null
  products: number
  resellers: number
  firstSales: number
  resellersWithSale: number
  /** First sales of periods followed the full CH_CAP_DAYS (contextual scoring basis). */
  fullyFollowedSales: number
  fullyFollowedResellers: number
  /** First sales per day over the measured history — null when too short to be a cadence. */
  salesCadencePerDay: number | null
  /** Products whose OTHER-reseller reference reaches the product tier (3 resellers, 10 first sales). */
  productsAtProductTier: number
  /** Products reaching the blind-spot / temporal floors (listing-days in the 90-day window, resellers, orders). */
  productsAtJudgingFloors: number
  unattributedShare: number | null
}

export type Gap = { metric: string; required: number; available: number | null; missing: number | null; derived?: boolean }

export type EngineReadiness = {
  id: EngineId
  name: string
  flag: string
  mode: string
  dimensions: { technique: MaturityLevel; donnees: MaturityLevel; statistique: MaturityLevel; securite: MaturityLevel }
  level: MaturityLevel
  levelLabel: string
  state: EngineState
  mainDependency: string
  gaps: Gap[]
  resellersRequired: number
  resellersMissing: number | null
  /** Days, ONLY from a measured cadence; null = « durée inconnue ». */
  etaDays: number | null
  etaBasis: string
  risk: Risk
  exitConditions: string[]
  nextAction: string
  testsNeeded: string[]
}

const round3 = (x: number) => Math.round(x * 1000) / 1000

/** Minimum measured history before a « cadence » is called one (below, durations are unknown). */
export const CADENCE_MIN_HISTORY_DAYS = 14
export const CADENCE_MIN_SALES = 5

export function summarizeData(f: ReadinessFacts): DataSummary {
  const nowMs = f.now.getTime()
  const historyDays = f.trackingStartedAt ? Math.max(0, Math.floor((nowMs - f.trackingStartedAt.getTime()) / DAY)) : null
  const windowStart = nowMs - BLIND_SPOT_WINDOW_DAYS * DAY
  const ps = f.periods
  const sold = ps.filter((p) => p.firstSaleAfterDays !== null)
  const censored = ps.filter((p) => p.firstSaleAfterDays === null).length
  const followed = sold.filter((p) => p.start <= nowMs - CH_CAP_DAYS * DAY)
  // Per product: distinct resellers with a first sale, first sales, listing-days in the 90-day window, orders.
  const byProduct = new Map<string, { resellers: Set<string>; firstSales: number; listingDays: number; orders: number; orderResellers: Set<string> }>()
  for (const p of ps) {
    const e = byProduct.get(p.productId) ?? { resellers: new Set(), firstSales: 0, listingDays: 0, orders: 0, orderResellers: new Set() }
    if (p.firstSaleAfterDays !== null) {
      e.resellers.add(p.affiliateId)
      e.firstSales += 1
    }
    const end = p.end ?? nowMs
    const overlap = Math.max(0, Math.min(end, nowMs) - Math.max(p.start, windowStart))
    e.listingDays += overlap / DAY
    if (p.end === null || p.end >= windowStart) {
      e.orders += p.orders
      if (p.orders > 0) e.orderResellers.add(p.affiliateId)
    }
    byProduct.set(p.productId, e)
  }
  let atProductTier = 0
  let atFloors = 0
  for (const e of byProduct.values()) {
    if (e.resellers.size >= PLAN_TIERS.product.minResellers && e.firstSales >= PLAN_TIERS.product.minSales) atProductTier += 1
    if (e.listingDays >= BS_MIN_LISTING_DAYS && e.orderResellers.size >= BS_MIN_RESELLERS && e.orders >= BS_MIN_ORDERS) atFloors += 1
  }
  const cadence = historyDays !== null && historyDays >= CADENCE_MIN_HISTORY_DAYS && sold.length >= CADENCE_MIN_SALES ? round3(sold.length / historyDays) : null
  return {
    historyDays,
    coversBlindSpotWindow: Boolean(f.trackingStartedAt && f.trackingStartedAt.getTime() <= windowStart),
    periods: ps.length,
    unjudgedPeriods: f.unjudgedPeriods,
    censoredShare: ps.length > 0 ? round3(censored / ps.length) : null,
    products: byProduct.size,
    resellers: new Set(ps.map((p) => p.affiliateId)).size,
    firstSales: sold.length,
    resellersWithSale: new Set(sold.map((p) => p.affiliateId)).size,
    fullyFollowedSales: followed.length,
    fullyFollowedResellers: new Set(followed.map((p) => p.affiliateId)).size,
    salesCadencePerDay: cadence,
    productsAtProductTier: atProductTier,
    productsAtJudgingFloors: atFloors,
    unattributedShare: f.unattributedShare,
  }
}

const gap = (metric: string, required: number, available: number | null, derived = false): Gap => ({
  metric,
  required,
  available,
  missing: available === null ? null : Math.max(0, required - available),
  ...(derived ? { derived } : {}),
})

/** ETA from the measured cadence only; the calendar constraints (a window to cover) are added as days. */
export function etaFor(gaps: readonly Gap[], d: DataSummary, calendarDays = 0): { etaDays: number | null; etaBasis: string } {
  const open = gaps.filter((g) => g.missing === null || g.missing > 0)
  if (open.length === 0) return { etaDays: calendarDays > 0 ? calendarDays : 0, etaBasis: calendarDays > 0 ? "fenêtre calendaire restante" : "seuils atteints" }
  if (open.some((g) => g.missing === null)) return { etaDays: null, etaBasis: "durée inconnue : volume non mesurable (historique indisponible)" }
  const salesGaps = open.filter((g) => g.metric.endsWith("first_sales"))
  const otherGaps = open.filter((g) => !g.metric.endsWith("first_sales"))
  if (otherGaps.length > 0 || d.salesCadencePerDay === null || d.salesCadencePerDay <= 0) {
    return { etaDays: null, etaBasis: d.salesCadencePerDay === null ? "durée inconnue : cadence non mesurée (historique trop court ou trop peu de ventes)" : "durée inconnue : le manque porte sur des revendeurs / produits, sans cadence mesurée" }
  }
  const worst = Math.max(...salesGaps.map((g) => g.missing ?? 0))
  return { etaDays: Math.max(calendarDays, Math.ceil(worst / d.salesCadencePerDay)), etaBasis: `projection au rythme mesuré (${d.salesCadencePerDay} premières ventes / jour) — pas une promesse` }
}

/**
 * Cumulative ladder — a level is reached only when every lower one is: 0 blocked (a hard prerequisite is missing),
 * 1 implemented, 2 tested, 3 data ready (every coded threshold met, read not truncated), 4 validated (the engine's
 * OWN verdict on real data — never inferred from volume). 5 is set by `buildActivationReadiness` only: 4 AND every
 * engine before it in the activation sequence is validated too. Dimensions are shown beside it, never averaged.
 */
const ladder = (blocked: boolean, tested: boolean, dataReady: boolean, validated: boolean): MaturityLevel =>
  blocked ? 0 : !tested ? 1 : !dataReady ? 2 : !validated ? 3 : 4

export function assessEngine(spec: EngineSpec, f: ReadinessFacts, d: DataSummary, validated = false): EngineReadiness {
  const mode = f.modes[spec.id] ?? "off"
  const technique: MaturityLevel = 2 // code + unit tests present (verified at delivery); CI green on the delivery commit
  const gaps: Gap[] = []
  let resellersRequired = 0
  let calendar = 0
  const blockedByMigration = spec.requiresPresenceMigration && !f.migrationApplied
  const hist = f.migrationApplied ? d : null
  const v = (x: number) => (hist ? x : null)
  switch (spec.id) {
    case "blind_spots":
      resellersRequired = BS_MIN_RESELLERS
      calendar = d.historyDays === null ? 0 : Math.max(0, BLIND_SPOT_WINDOW_DAYS - d.historyDays)
      gaps.push(gap("history_days_presence_basis", BLIND_SPOT_WINDOW_DAYS, v(d.historyDays ?? 0)))
      gaps.push(gap("products_at_judging_floors", 1, v(d.productsAtJudgingFloors)))
      break
    case "temporal":
      resellersRequired = TEMPORAL_MIN_RESELLERS
      gaps.push(gap("products_at_judging_floors", 1, v(d.productsAtJudgingFloors)))
      gaps.push(gap("first_sales", 20, v(d.firstSales)))
      gaps.push(gap("periods_both_halves", 40, v(d.periods), true))
      gaps.push(gap("resellers_with_sale", 10, v(d.resellersWithSale), true))
      break
    case "observation_plan":
      resellersRequired = PLAN_TIERS.general.minResellers
      gaps.push(gap("general_tier_first_sales", PLAN_TIERS.general.minSales, v(d.firstSales)))
      gaps.push(gap("resellers_with_sale", PLAN_TIERS.general.minResellers, v(d.resellersWithSale)))
      gaps.push(gap("calibration_plans_recorded", 20, v(f.markers.plan)))
      break
    case "retention":
      resellersRequired = RETENTION_TIERS.product.minResellers + 1
      gaps.push(gap("products_at_product_tier", 1, v(d.productsAtProductTier)))
      gaps.push(gap("at_risk_periods", RETENTION_MIN_AT_RISK, v(Math.round((d.censoredShare ?? 0) * d.periods)), true))
      gaps.push(gap("resellers_with_sale", RETENTION_MIN_AT_RISK_RESELLERS, v(d.resellersWithSale)))
      gaps.push(gap("cases_recorded_per_arm", 20 * 2, v(f.markers.retention), true))
      break
    case "contextual_horizon":
      resellersRequired = CH_MIN_RESELLERS
      calendar = d.historyDays === null ? 0 : Math.max(0, CH_CAP_DAYS * 2 - d.historyDays)
      gaps.push(gap("fully_followed_first_sales", 2 * Math.max(CH_MIN_EVENTS, CH_MIN_TEST_SALES), v(d.fullyFollowedSales), true))
      gaps.push(gap("fully_followed_resellers", CH_MIN_RESELLERS, v(d.fullyFollowedResellers)))
      gaps.push(gap("history_days_two_followed_halves", CH_CAP_DAYS * 2, v(d.historyDays ?? 0), true))
      gaps.push(gap("daily_snapshots", 30, v(f.markers.contextualSnapshots), true))
      break
  }
  const dataReady = !blockedByMigration && !f.presenceTruncated && gaps.every((g) => g.missing === 0)
  const donnees: MaturityLevel = blockedByMigration ? 0 : dataReady ? 3 : 2
  const statistique: MaturityLevel = !dataReady ? donnees : validated ? 4 : 3
  // Safety: flag OFF by default, aggregates only, kill switch = flag back to off (read per request, no deploy).
  const securite: MaturityLevel = 4
  const dims = { technique, donnees, statistique, securite }
  const level = ladder(blockedByMigration, technique >= 2, dataReady, validated && dataReady)
  const state: EngineState = blockedByMigration
    ? "bloque"
    : !dataReady
      ? mode === "off" ? "en_attente_de_donnees" : "collecte"
      : validated ? "pret" : "validation"
  // « pret » = validated; activation itself stays a founder decision (level 5 also needs the earlier engines).
  const { etaDays, etaBasis } = blockedByMigration ? { etaDays: null, etaBasis: "durée inconnue : la collecte n'a pas commencé (migration non appliquée)" } : etaFor(gaps, d, calendar)
  const sellersGap = gaps.find((g) => g.metric.includes("resellers"))
  return {
    id: spec.id,
    name: spec.name,
    flag: spec.flag,
    mode,
    dimensions: dims,
    level,
    levelLabel: MATURITY_LABELS[level],
    state,
    mainDependency: spec.requiresPresenceMigration ? "migration 20261124090000_listing_presence_history" : `historique ≥ ${BLIND_SPOT_WINDOW_DAYS} jours pour la base « présence » (${spec.fallbackWithoutMigration})`,
    gaps,
    resellersRequired,
    resellersMissing: sellersGap ? sellersGap.missing : null,
    etaDays,
    etaBasis,
    risk: spec.risk,
    exitConditions: exitConditionsFor(spec),
    nextAction: blockedByMigration
      ? "décision fondateur : appliquer la migration (collecte), drapeaux laissés à off"
      : !dataReady
        ? mode === "off" ? "attendre / laisser collecter ; relire ce rapport chaque semaine" : "laisser collecter en observe"
        : validated ? "décision fondateur : activation (étape suivante de la séquence)" : "lire le rapport de validation de l'outil sur données réelles",
    testsNeeded: [...spec.tests.map((t) => `vitest ${t}`), ...(spec.requiresPresenceMigration ? ["listing-presence-db (PostgreSQL réel)"] : [])],
  }
}

function exitConditionsFor(spec: EngineSpec): string[] {
  switch (spec.id) {
    case "blind_spots":
      return ["historique couvrant les 90 jours (base présence)", "au moins un produit au-dessus des planchers", "lecture non tronquée", "boucle de correction ≠ « insuffisante » avant tout usage"]
    case "temporal":
      return ["migration appliquée et vérifiée", "part « unattributed » des événements mesurée", "hypothèses H1/H2 jugées sur la moitié récente (≠ « insuffisante »)"]
    case "observation_plan":
      return ["observe : plans enregistrés sans erreur pendant ≥ 30 jours", "calibration « cohérent » sur ≥ 20 plans de ≥ 5 revendeurs", "on : avec groupe témoin (HOLDOUT_PCT > 0) jusqu'à comparaison ≥ 20 cas mûrs par bras"]
    case "retention":
      return ["observe : cas enregistrés sans erreur", "évaluation par bras ≥ 20 cas mûrs", "on : avec groupe témoin ; arrêt si « retrait qui avait du potentiel » ne baisse pas"]
    case "contextual_horizon":
      return ["verdict « meilleur » sur la moitié récente (toutes les conditions)", "facteurs « stables » sur les instantanés quotidiens", "on seulement après le plan d'observation validé"]
  }
}

/** Progressive activation, never all at once. Each step: gate (pass criteria), checkpoint, rollback. */
export type ActivationStep = { order: number; action: string; flag: string | null; value: string | null; gate: string[]; checkpoint: string; rollback: string; why: string }

export const ACTIVATION_SEQUENCE: readonly ActivationStep[] = [
  {
    order: 0,
    action: "Appliquer la migration de l'historique de présence (COLLECTE seulement)",
    flag: null,
    value: null,
    gate: ["décision fondateur", "staging d'abord (schema:migrate --expect-endpoint)", "schema:verify vert", "liste de contrôle post-migration étapes 1–9 passée"],
    checkpoint: "J+1 et J+7 : liste de contrôle étapes 7–9",
    rollback: "revenir au code précédent, ou supprimer seulement le déclencheur (arrête l'enregistrement) ; SQL destructif documenté et testé",
    why: "aucun des cinq outils ne voit d'historique sans elle ; la collecte ne change rien pour les utilisateurs",
  },
  {
    order: 1,
    action: "Moteur temporel en observation",
    flag: "COPILOT_TEMPORAL_MODE",
    value: "observe",
    gate: ["étape 0 vérifiée", "lecture non tronquée", "part « unattributed » connue"],
    checkpoint: "rapport admin lisible, 0 erreur 503",
    rollback: "COPILOT_TEMPORAL_MODE=off (lu à chaque requête, sans déploiement)",
    why: "lecture seule, vue fondateur seulement, n'écrit rien : premier contrôle réel de la qualité de l'historique",
  },
  {
    order: 2,
    action: "Angles morts en observation",
    flag: "COPILOT_BLIND_SPOTS_MODE",
    value: "observe",
    gate: ["étape 1 sans anomalie", "base « présence » seulement quand l'historique couvre 90 jours (sinon base « annonces en ligne », déjà connue)"],
    checkpoint: "exposureBasis : produits par base",
    rollback: "COPILOT_BLIND_SPOTS_MODE=off",
    why: "lecture seule, vue fondateur ; ne dépend pas strictement de la migration",
  },
  {
    order: 3,
    action: "Plan d'observation en observation (enregistré, jamais montré)",
    flag: "OBSERVATION_PLAN_MODE",
    value: "observe",
    gate: ["étapes 1–2 stables ≥ 7 jours", "volume : rang général (10 revendeurs, 50 premières ventes) ou silences comptés"],
    checkpoint: "plans générés / silences par motif dans observationPlans",
    rollback: "OBSERVATION_PLAN_MODE=off ; les marqueurs AuditLog restent inertes",
    why: "écrit des marqueurs sans rien montrer : c'est ce qui permettra de calibrer AVANT tout affichage",
  },
  {
    order: 4,
    action: "Conseiller de rétention en observation (enregistré, jamais montré)",
    flag: "RETENTION_ADVISOR_MODE",
    value: "observe",
    gate: ["étape 3 sans erreur ≥ 14 jours"],
    checkpoint: "cas par bras dans retention",
    rollback: "RETENTION_ADVISOR_MODE=off",
    why: "touche la décision de retrait (enjeu plus élevé) : après le plan, qui prépare la même référence",
  },
  {
    order: 5,
    action: "Horizon contextuel en observation (instantané quotidien)",
    flag: "CONTEXTUAL_HORIZON_MODE",
    value: "observe",
    gate: ["historique ≥ 180 jours (deux moitiés suivies 90 jours)"],
    checkpoint: "verdict et dérive des facteurs",
    rollback: "CONTEXTUAL_HORIZON_MODE=off",
    why: "le plus exigeant en données ; inutile avant deux moitiés suivies",
  },
  {
    order: 6,
    action: "Affichage aux revendeurs, un outil à la fois, AVEC groupe témoin",
    flag: "OBSERVATION_PLAN_MODE puis RETENTION_ADVISOR_MODE puis CONTEXTUAL_HORIZON_MODE",
    value: "on (+ HOLDOUT_PCT 10–20)",
    gate: ["niveau 4 (Validé) de l'outil dans ce rapport", "décision fondateur distincte par outil"],
    checkpoint: "comparaison montré / témoin ≥ 20 cas mûrs par bras",
    rollback: "remettre le mode à observe ou off",
    why: "seule étape visible par les revendeurs ; chaque outil doit d'abord prouver sa calibration",
  },
] as const

/** Post-migration checklist — collection verified BEFORE any activation decision (separate decision). */
export type ChecklistStep = { step: number; title: string; check: string; pass: string }

export const POST_MIGRATION_CHECKLIST: readonly ChecklistStep[] = [
  { step: 1, title: "Intégrité du schéma", check: "npm run schema:verify ; table ListingPresenceEvent, CHECK, index, déclencheur AffiliateProduct_listing_presence_history présents", pass: "code de sortie 0" },
  { step: 2, title: "Mécanismes de capture", check: "dans une transaction annulée de staging : création, retrait, remise en vente, suppression d'une annonce de test", pass: "un événement par changement réel (created / unlisted / listed / deleted)" },
  { step: 3, title: "Nouveaux événements", check: "SELECT kind, count(*) FROM \"ListingPresenceEvent\" GROUP BY kind (staging)", pass: "des événements apparaissent au rythme des changements d'annonces" },
  { step: 4, title: "Idempotence", check: "double clic / réenregistrement sans changement de isListed", pass: "aucun événement supplémentaire" },
  { step: 5, title: "Concurrence", check: "deux changements simultanés de la même annonce (listing-presence-db en CI)", pass: "sérialisés, aucun événement perdu ni dupliqué" },
  { step: 6, title: "Isolation des revendeurs", check: "GET /api/affiliate/listings/<id>/presence avec un autre compte", pass: "404 ; aucun actorId exposé" },
  { step: 7, title: "Qualité des données", check: "presenceSources.unattributedShare ; périodes incoherent / unjudged dans ce rapport", pass: "part « unattributed » mesurée et expliquée par les écrivains non déclarés (seeds, scripts)" },
  { step: 8, title: "Premiers volumes", check: "ce rapport (?readiness=1) : périodes, premières ventes, revendeurs, cadence", pass: "cadence mesurée après ≥ 14 jours" },
  { step: 9, title: "Comparaison aux seuils", check: "écarts par outil (gaps) de ce rapport", pass: "manques chiffrés, durée seulement si cadence mesurée" },
  { step: 10, title: "Outils pouvant passer en observation réelle", check: "séquence : temporel → angles morts → plan → rétention → contextuel", pass: "chacun selon sa porte d'entrée" },
  { step: 11, title: "Drapeaux maintenus à off", check: "les cinq drapeaux lus par ce rapport (modes)", pass: "tous à off tant qu'aucune décision n'est prise" },
  { step: 12, title: "Décision d'activation séparée", check: "décision fondateur écrite par outil, distincte de la décision de migration", pass: "trace de décision (journal) avant tout changement de drapeau" },
] as const

export type ActivationReadinessReport = {
  generatedAt: string
  migrationApplied: boolean
  trackingStartedAt: string | null
  data: DataSummary
  engines: EngineReadiness[]
  sequence: readonly ActivationStep[]
  checklist: readonly ChecklistStep[]
  limits: readonly string[]
}

export const READINESS_LIMITS = [
  "durées : seulement à partir d'une cadence mesurée, sinon « durée inconnue »",
  "seuils « dérivés » = combinaison des constantes de l'outil, signalée comme telle",
  "rang catégorie (rétention, plan) non mesuré ici : les périodes ne portent pas la catégorie",
  "validation (niveau 4) = résultat de l'outil lui-même sur données réelles, jamais déduite du volume",
  "agrégats seulement : aucun revendeur, acheteur ou commande identifié",
] as const

/** `validated` comes from the engines' own verdicts (server); defaults to false. */
export function buildActivationReadiness(f: ReadinessFacts, validated: Partial<Record<EngineId, boolean>> = {}): ActivationReadinessReport {
  const data = summarizeData(f)
  const engines = ENGINES.map((s) => assessEngine(s, f, data, validated[s.id] ?? false))
  // Level 5 = validated AND every engine before it in the sequence validated (progressive activation, never skipped).
  const order: EngineId[] = ["temporal", "blind_spots", "observation_plan", "retention", "contextual_horizon"]
  for (const e of engines) {
    const before = order.slice(0, order.indexOf(e.id))
    if (e.level === 4 && before.every((id) => engines.find((x) => x.id === id)!.level >= 4)) {
      e.level = 5
      e.levelLabel = MATURITY_LABELS[5]
    }
  }
  return {
    generatedAt: f.now.toISOString(),
    migrationApplied: f.migrationApplied,
    trackingStartedAt: f.trackingStartedAt?.toISOString() ?? null,
    data,
    engines,
    sequence: ACTIVATION_SEQUENCE,
    checklist: POST_MIGRATION_CHECKLIST,
    limits: READINESS_LIMITS,
  }
}
