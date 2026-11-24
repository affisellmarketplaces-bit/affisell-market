/**
 * Historical data launch gate — ONE decision sheet for starting the presence-history collection and, later, observing
 * the copilot engines (founder brief 2026-11-24 « Historical Data Launch Gate »). PURE: it EXECUTES NOTHING. It reads
 * what the existing tools already produce (`report:presence-readiness`, the activation-readiness registry and sequence,
 * the destination classification of the read-only reports) and says, step by step, what is proven, what is unknown and
 * which SEPARATE authorization each sensitive operation needs. There is no executor here: every operation it unlocks is
 * run by hand with the existing commands (`schema:migrate --expect-endpoint`, a flag change on Vercel).
 *
 * Steps (each its own authorization, never inferred from the previous one):
 *   A  Préparation                      — repository + static checks + readiness report; modifies nothing.
 *   B  Migration staging                — destination PROVEN staging; applying it STARTS capture on staging.
 *   C  Vérification post-migration      — read-only report on staging after B.
 *   D  Démarrage de la collecte         — = applying the migration in PRODUCTION (the trigger records from that
 *                                          instant; there is no separate « collection » switch).
 *   E  Observation d'un moteur          — per engine, `observe`, in the documented order.
 *   F  Activation fonctionnelle         — per engine, `on`; never follows from E's success.
 *
 * What this module refuses, whatever is passed: a production or unidentified destination for B / C, an authorization
 * for another step / engine / destination, an E or F authorization standing in for another, F without the engine's
 * own validation (level ≥ 4 of the activation-readiness report), and any « next step » that would be automatic.
 */
import type { PresenceReadinessReport, CheckStatus } from "../listing-presence/integrity"
import { ACTIVATION_SEQUENCE, ENGINES, type EngineId } from "../reseller-copilot/activation-readiness"

export type StepId = "A" | "B" | "C" | "D" | "E" | "F"
export type Destination = { endpoint: string; branch: "production" | "staging" | "local" | "unknown" }

/** The written trace of a founder decision. One per step (and per engine for E / F). Never derived. */
export type Authorization = {
  step: StepId
  /** Required for B, C, D: the exact endpoint id the decision names. */
  endpoint?: string
  /** Required for E, F. */
  engine?: EngineId
  grantedBy: string
  grantedAt: Date
  /** Free reason, kept as written (never read as an instruction). */
  note: string
}

export type StepOutcome = "non_fait" | "fait" | "echec"
export type GateState = {
  outcomes: Partial<Record<StepId, StepOutcome>>
  /** Engines currently in observe / on, as READ from their flags (never written here). */
  engineModes: Partial<Record<EngineId, "off" | "observe" | "on" | "inconnu">>
  /** Activation-readiness level per engine (0–5), null = unknown. */
  engineLevels: Partial<Record<EngineId, number | null>>
  /** Control-group share per engine, as READ from its *_HOLDOUT_PCT flag (null = unknown). */
  holdoutPct?: Partial<Record<EngineId, number | null>>
  /** Days since collection started (D done), null = not started / unknown. */
  daysSinceCollection: number | null
  /** Result of the J+1 / J+7 checks (`postStartCheck`). */
  checkpoints: { j1: CheckStatus | null; j7: CheckStatus | null }
  /** Global status of the latest readiness report on the destination concerned. */
  readinessGlobal: CheckStatus | null
}

export type StepDecision = { step: StepId; engine?: EngineId; allowed: boolean; reasons: string[]; executesAutomatically: false }

/** An engine whose reseller-facing effect goes through another engine uses that engine's control group. */
export const HOLDOUT_VIA: Partial<Record<EngineId, EngineId>> = { contextual_horizon: "observation_plan" }

/** Order of the engines in observe — read from the documented sequence (activation-readiness.ts), never re-written. */
export const ENGINE_OBSERVE_ORDER: readonly EngineId[] = ACTIVATION_SEQUENCE.filter((s) => s.order >= 1 && s.order <= 5 && s.value === "observe")
  .map((s) => ENGINES.find((e) => e.flag === s.flag)?.id)
  .filter((x): x is EngineId => Boolean(x))

const findAuth = (auths: readonly Authorization[], step: StepId, pred: (a: Authorization) => boolean) => auths.find((a) => a.step === step && pred(a))

function authFor(auths: readonly Authorization[], step: StepId, opts: { endpoint?: string; engine?: EngineId }): { ok: boolean; reason?: string } {
  const sameStep = auths.filter((a) => a.step === step)
  if (sameStep.length === 0) return { ok: false, reason: `aucune autorisation écrite pour l'étape ${step}` }
  const a = findAuth(auths, step, (x) => (opts.endpoint ? x.endpoint?.toLowerCase() === opts.endpoint.toLowerCase() : true) && (opts.engine ? x.engine === opts.engine : true))
  if (!a) return { ok: false, reason: `l'autorisation de l'étape ${step} ne nomme pas ${opts.endpoint ?? opts.engine}` }
  if (!a.grantedBy.trim() || !a.note.trim()) return { ok: false, reason: `autorisation ${step} incomplète (auteur et motif requis)` }
  return { ok: true }
}

/**
 * May the operation of `step` be run (BY HAND) now? Pure: no side effect, and the answer is never « done
 * automatically ». `destination` is what the read-only reports' classification says of the target.
 */
export function evaluateStep(
  step: StepId,
  ctx: { destination?: Destination | null; engine?: EngineId; auths: readonly Authorization[]; state: GateState },
): StepDecision {
  const reasons: string[] = []
  const out = (allowed: boolean): StepDecision => ({ step, ...(ctx.engine ? { engine: ctx.engine } : {}), allowed: allowed && reasons.length === 0, reasons, executesAutomatically: false })
  const done = (s: StepId) => ctx.state.outcomes[s] === "fait"
  const dest = ctx.destination ?? null

  if (step === "A") return out(true) // reads the repository; modifies nothing

  if (step === "B" || step === "C") {
    if (!dest) reasons.push("destination non fournie")
    else if (dest.branch === "production") reasons.push("destination de PRODUCTION refusée : les étapes B et C ne visent que le staging")
    else if (dest.branch !== "staging") reasons.push(`destination « ${dest.branch} » : impossible de prouver que c'est le staging`)
    if (!done("A")) reasons.push("étape A non faite")
    if (step === "B" && ctx.state.readinessGlobal === "BLOCKED") reasons.push("rapport de préparation BLOQUÉ")
    if (step === "C" && !done("B")) reasons.push("migration staging (B) non constatée")
    if (dest) {
      const a = authFor(ctx.auths, step, { endpoint: dest.endpoint })
      if (!a.ok) reasons.push(a.reason!)
    }
    return out(true)
  }

  if (step === "D") {
    if (!dest) reasons.push("destination non fournie")
    else if (dest.branch !== "production") reasons.push(`l'étape D vise la production ; destination « ${dest.branch} »`)
    if (!done("C")) reasons.push("vérification post-migration staging (C) non réussie")
    if (ctx.state.readinessGlobal !== "PASS" && ctx.state.readinessGlobal !== "WARN") reasons.push(`rapport de préparation staging : ${ctx.state.readinessGlobal ?? "inconnu"} (PASS ou WARN requis)`)
    if (dest) {
      const a = authFor(ctx.auths, "D", { endpoint: dest.endpoint })
      if (!a.ok) reasons.push(a.reason!)
    }
    // An authorization for B or C never stands in for D (the founder decides production apart).
    return out(true)
  }

  // E and F: per engine.
  const engine = ctx.engine
  if (!engine) {
    reasons.push("moteur non précisé")
    return out(false)
  }
  const spec = ENGINES.find((e) => e.id === engine)!
  if (spec.requiresPresenceMigration && !done("D")) reasons.push("collecte non démarrée (D) : ce moteur n'a rien à lire sans l'historique")
  if (step === "E") {
    if (ctx.state.daysSinceCollection != null || done("D")) {
      if (ctx.state.checkpoints.j7 == null) reasons.push("contrôle J+7 de la collecte non fait")
      else if (ctx.state.checkpoints.j7 === "BLOCKED" || ctx.state.checkpoints.j7 === "UNKNOWN") reasons.push(`contrôle J+7 : ${ctx.state.checkpoints.j7}`)
    }
    const idx = ENGINE_OBSERVE_ORDER.indexOf(engine)
    for (const before of ENGINE_OBSERVE_ORDER.slice(0, Math.max(0, idx))) {
      const m = ctx.state.engineModes[before]
      if (m !== "observe" && m !== "on") reasons.push(`dépendance : ${before} doit être en observation avant ${engine}`)
    }
    const lvl = ctx.state.engineLevels[engine]
    if (lvl == null) reasons.push("niveau de préparation du moteur inconnu")
    else if (lvl < 2) reasons.push(`niveau de préparation ${lvl} < 2 (Testé)`)
    const a = authFor(ctx.auths, "E", { engine })
    if (!a.ok) reasons.push(a.reason!)
    return out(true)
  }
  // F
  if (ctx.state.engineModes[engine] !== "observe") reasons.push("le moteur doit d'abord être en observation (E)")
  const lvl = ctx.state.engineLevels[engine]
  if (lvl == null || lvl < 4) reasons.push(`niveau ${lvl ?? "inconnu"} < 4 (Validé sur données réelles)`)
  if (spec.resellerFacing) {
    // The contextual horizon reaches resellers THROUGH the observation plan: its control group is the plan's.
    const via = HOLDOUT_VIA[engine] ?? engine
    if (via !== engine && ctx.state.engineModes[via] !== "on") reasons.push(`passe par ${via}, qui doit d'abord être activé (avec son groupe témoin)`)
    const pct = ctx.state.holdoutPct?.[via]
    if (pct == null || !(pct > 0)) reasons.push(`groupe témoin de ${via} non configuré (pourcentage > 0 requis pour un moteur visible des revendeurs)`)
  }
  const a = authFor(ctx.auths, "F", { engine })
  if (!a.ok) reasons.push(a.reason!) // an E authorization never counts for F
  return out(true)
}

// ── Rollback and emergency stop: four DIFFERENT operations, never confused ───────────────────────────────────────

export type StopKind = "desactivation_moteur" | "arret_collecte" | "rollback_migration" | "restauration_donnees"
export type StopProcedure = {
  kind: StopKind
  action: string
  /** Data touched, and whether something already collected is LOST. */
  dataAffected: string
  losesCollectedData: boolean
  engineConsequence: string
  verify: string
}

export const STOP_PROCEDURES: Record<StopKind, StopProcedure> = {
  desactivation_moteur: {
    kind: "desactivation_moteur",
    action: "remettre le drapeau du moteur à off (lu à chaque requête, sans déploiement de code)",
    dataAffected: "aucune ; les marqueurs AuditLog déjà écrits restent, inertes",
    losesCollectedData: false,
    engineConsequence: "ce moteur seul cesse de lire / écrire ; la collecte continue ; les autres moteurs inchangés",
    verify: "la route admin de ce moteur répond « off » / plus de nouveau marqueur à J+1",
  },
  arret_collecte: {
    kind: "arret_collecte",
    action: "supprimer SEULEMENT le déclencheur AffiliateProduct_listing_presence_history (la table et ses événements restent)",
    dataAffected: "aucune ligne supprimée ; les changements faits pendant l'arrêt ne sont JAMAIS enregistrés (trou définitif dans l'historique)",
    losesCollectedData: false,
    engineConsequence: "les moteurs lisent un historique qui s'arrête : périodes en cours deviennent « incohérentes » à la reprise ; repasser les moteurs à off",
    verify: "report:presence-readiness : déclencheur absent (BLOQUÉ) ; aucun nouvel événement après l'heure d'arrêt",
  },
  rollback_migration: {
    kind: "rollback_migration",
    action: "scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql (destructif, testé en CI)",
    dataAffected: "la table ListingPresenceEvent est SUPPRIMÉE avec tous les événements collectés",
    losesCollectedData: true,
    engineConsequence: "tous les moteurs reviennent à « historique indisponible » ; une réapplication repart de zéro (aucun passé reconstruit)",
    verify: "report:presence-readiness : migration absente ; moteurs « indisponible »",
  },
  restauration_donnees: {
    kind: "restauration_donnees",
    action: "restauration PITR Neon EN PLACE (docs/BACKUP-RESTORE.md, procédure jamais exercée)",
    dataAffected: "TOUTE la base revient à l'instant choisi : commandes, paiements, annonces postérieurs perdus — pas seulement l'historique",
    losesCollectedData: true,
    engineConsequence: "tout ce qui a été écrit après l'instant restauré disparaît ; à réserver à une corruption, jamais pour arrêter une collecte",
    verify: "procédure §9 de BACKUP-RESTORE.md (jamais exécutée à ce jour)",
  },
}

export type StepSpec = {
  id: StepId
  title: string
  modifiesDatabase: "non" | "staging" | "production" | "drapeau"
  authorization: string
  success: string[]
  stopWhen: string[]
  risks: string[]
  stop: StopKind | null
}

export const LAUNCH_STEPS: readonly StepSpec[] = [
  {
    id: "A",
    title: "Préparation",
    modifiesDatabase: "non",
    authorization: "aucune (lecture du dépôt et rapport --static)",
    success: ["report:presence-readiness -- --static sans contrôle BLOQUÉ", "fiche produite (report:launch-gate)", "CI verte sur le commit visé"],
    stopWhen: ["un contrôle statique BLOQUÉ (migration ou retour arrière incohérent)"],
    risks: [],
    stop: null,
  },
  {
    id: "B",
    title: "Migration staging",
    modifiesDatabase: "staging",
    authorization: "écrite, nommant l'endpoint staging (ep-shy-wind-…) ; ne vaut pour aucune autre étape",
    success: ["schema:migrate -- --expect-endpoint <staging> sort à 0", "schema:verify sort à 0"],
    stopWhen: ["endpoint différent de celui autorisé", "sortie ≠ 0", "rôle de migration identique au rôle applicatif sans décision"],
    risks: ["la capture démarre sur le staging dès l'application (données de staging seulement)", "sauvegarde du staging non vérifiée (procédure jamais exercée)"],
    stop: "rollback_migration",
  },
  {
    id: "C",
    title: "Vérification post-migration (staging)",
    modifiesDatabase: "non",
    authorization: "écrite, lecture seule du staging",
    success: ["report:presence-readiness sur le staging : PASS ou WARN expliqué", "liste POST_MIGRATION_CHECKLIST 1–7 constatée", "UTC, idempotence, TRUNCATE refusé, attribution : contrôles A–E du rapport"],
    stopWhen: ["un contrôle critique BLOQUÉ ou INCONNU", "déclencheur désactivé ou incorrect", "mode réplique par défaut sur un rôle"],
    risks: ["les sessions des AUTRES rôles ne sont pas visibles (mode réplique non détectable en direct)"],
    stop: "arret_collecte",
  },
  {
    id: "D",
    title: "Démarrage de la collecte (production)",
    modifiesDatabase: "production",
    authorization: "écrite, DISTINCTE, nommant l'endpoint de production ; appliquer la migration EST le démarrage (aucun autre interrupteur)",
    success: ["schema:migrate -- --expect-endpoint <prod> --confirm-production sort à 0", "J+1 et J+7 : postStartCheck PASS ou WARN expliqué"],
    stopWhen: ["J+1 ou J+7 BLOQUÉ", "événements incohérents en hausse", "part « unattributed » > 0 sur un écrivain applicatif connu"],
    risks: ["irréversible au sens où un rollback supprime ce qui a été collecté", "le propriétaire de la table peut désactiver le déclencheur", "le mode réplique coupe la capture sans erreur"],
    stop: "arret_collecte",
  },
  {
    id: "E",
    title: "Observation d'un moteur",
    modifiesDatabase: "drapeau",
    authorization: "écrite, PAR MOTEUR, valeur observe, dans l'ordre documenté",
    success: ["route admin du moteur lisible, 0 erreur", "métriques d'observation du moteur produites"],
    stopWhen: ["erreurs de lecture", "lecture tronquée", "anomalie de l'historique remontée par le moteur"],
    risks: ["observe écrit des marqueurs AuditLog pour plan / rétention / contextuel (jamais montrés)"],
    stop: "desactivation_moteur",
  },
  {
    id: "F",
    title: "Activation fonctionnelle d'un moteur",
    modifiesDatabase: "drapeau",
    authorization: "écrite, PAR MOTEUR, valeur on, distincte de E ; groupe témoin pour un moteur visible des revendeurs",
    success: ["niveau 4 (Validé) du moteur", "comparaison montré / témoin ≥ 20 cas mûrs par bras"],
    stopWhen: ["calibration dégradée", "plainte revendeur", "écart témoin défavorable"],
    risks: ["seule étape visible par les revendeurs"],
    stop: "desactivation_moteur",
  },
]

// ── After the start: J+1 / J+7, from the EXISTING readiness report only ────────────────────────────────────────────

/** Each monitoring question → where its answer already is (no new dashboard). */
export const OBSERVABILITY_QUESTIONS: ReadonlyArray<{ question: string; source: string }> = [
  { question: "Combien de nouvelles périodes ?", source: "report:presence-readiness → volumes.completePeriods / ongoingPeriods" },
  { question: "Quelle part des événements a une provenance identifiable ?", source: "report:presence-readiness → contrôle « attribution » (bySource) ; loadPresenceSourceCoverage" },
  { question: "Existe-t-il des événements unattributed ?", source: "bySource.unattributed (doit être 0 sur les écrivains applicatifs : verrou CI listing-mutation-provenance)" },
  { question: "Combien de périodes incomplètes ou inconnues ?", source: "volumes.unjudgedPeriods ; contrôles C (ruptures de chaîne)" },
  { question: "Anomalies de chronologie ?", source: "contrôles C : chainBreaks, createdNotFirst, afterDeleted, futureEvents, orderInversions" },
  { question: "Les déclencheurs fonctionnent-ils ?", source: "contrôles B/E : présents, corrects, activés ; stateMismatches ; createdWithoutEvent" },
  { question: "Les volumes suffisent-ils aux moteurs ?", source: "GET /api/admin/copilot-blind-spots?readiness=1 → gaps par moteur" },
  { question: "Les résultats évoluent-ils de façon cohérente ?", source: "comparaison J+1 → J+7 de postStartCheck (événements croissants, anomalies stables à 0)" },
]

export type PostStartCheck = { day: "J+1" | "J+7"; status: CheckStatus; findings: string[] }

/** J+1 / J+7: what must hold in the readiness report once collection runs. UNKNOWN when the report was not read. */
export function postStartCheck(day: "J+1" | "J+7", r: PresenceReadinessReport | null): PostStartCheck {
  if (!r) return { day, status: "UNKNOWN", findings: ["rapport de préparation non lu sur la destination"] }
  const findings: string[] = []
  let status: CheckStatus = r.global
  const critical = r.checks.filter((c) => c.critical && c.status !== "PASS")
  for (const c of critical) findings.push(`${c.id} : ${c.status}`)
  const v = r.volumes
  if (!v) {
    findings.push("volumes non calculés")
    if (status === "PASS") status = "UNKNOWN"
  } else if (v.listingsWithHistory === 0) {
    findings.push("aucune annonce avec historique : la capture n'a rien enregistré")
    status = day === "J+7" ? "BLOCKED" : status === "PASS" ? "WARN" : status
  }
  return { day, status, findings }
}

// ── Flags: read, never written ─────────────────────────────────────────────────────────────────────────────────────

/** Every flag that touches the history or reads it. Values are normalised: a raw value is never printed. */
export const HISTORY_FLAGS = [
  ...ENGINES.map((e) => e.flag),
  ...ENGINES.flatMap((e) => (e.holdoutFlag ? [e.holdoutFlag] : [])),
  "HISTORICAL_EXPOSURE_MODE",
  "COPILOT_LEARNING_MODE",
] as const

export function readFlagStates(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of HISTORY_FLAGS) {
    const raw = (env[f] ?? "").trim().toLowerCase()
    if (f.endsWith("_PCT")) out[f] = raw === "" ? "0 (défaut)" : /^\d{1,3}$/.test(raw) ? raw : "valeur invalide"
    else out[f] = raw === "" ? "off (défaut)" : ["off", "observe", "on", "warn", "enforce"].includes(raw) ? raw : "valeur non reconnue"
  }
  return out
}

// ── The decision sheet ────────────────────────────────────────────────────────────────────────────────────────────

export type EvidenceKind = "fait_verifie" | "resultat_de_test" | "inconnu" | "hypothese" | "risque" | "decision"
export type Evidence = { kind: EvidenceKind; topic: string; text: string }

export type GitFacts = { branch: string; head: string; remoteHead: string | null; clean: boolean }

export type LaunchDecisionSheet = {
  generatedAt: string
  /** Where the facts come from: `statique` = repository only (no database read by this tool). */
  basis: { readiness: "statique" | "fichier_fourni"; activation: "absent" | "fichier_fourni" }
  evidence: Evidence[]
  steps: Array<StepSpec & { decision: StepDecision }>
  engines: Array<{ engine: EngineId; order: number; observe: StepDecision; activate: StepDecision }>
  flags: Record<string, string>
  stops: StopProcedure[]
  observability: typeof OBSERVABILITY_QUESTIONS
  /** Always true: this sheet never runs anything. */
  executesNothing: true
}

const TESTS_PRESENT = [
  "presence-readiness (35) + presence-readiness-db (PostgreSQL réel en CI)",
  "listing-presence + listing-presence-db",
  "listing-mutation-provenance (verrou CI) + listing-mutation-provenance-db",
  "historical-exposure + historical-exposure-db",
  "copilot-activation-readiness",
  "launch-gate (cette fiche)",
]

export function buildLaunchDecisionSheet(i: {
  now: Date
  git: GitFacts | null
  readiness: PresenceReadinessReport
  readinessFromFile: boolean
  activation: { engines: Array<{ id: EngineId; level: number }> } | null
  flags: Record<string, string>
  state: GateState
  auths: readonly Authorization[]
  stagingDestination?: Destination | null
  productionDestination?: Destination | null
}): LaunchDecisionSheet {
  const ev: Evidence[] = []
  const push = (kind: EvidenceKind, topic: string, text: string) => ev.push({ kind, topic, text })

  if (!i.git) push("inconnu", "branche", "état Git non lu")
  else {
    push("fait_verifie", "branche", `${i.git.branch} @ ${i.git.head.slice(0, 9)}${i.git.clean ? ", arbre propre" : ", MODIFICATIONS NON COMMITÉES"}`)
    if (i.git.remoteHead == null) push("inconnu", "branche", "état distant non lu (pas de réseau ?)")
    else if (i.git.remoteHead === i.git.head) push("fait_verifie", "branche", "identique au distant")
    else push("risque", "branche", `différente du distant (${i.git.remoteHead.slice(0, 9)})`)
  }

  for (const c of i.readiness.checks) {
    const topic = `${c.section} · ${c.id}`
    if (!c.executed || c.status === "UNKNOWN") push("inconnu", topic, `${c.title} — non vérifié${c.evidence[0] ? ` (${c.evidence[0]})` : ""}`)
    else if (c.status === "PASS") push(i.readinessFromFile ? "resultat_de_test" : "fait_verifie", topic, c.title)
    else push("risque", topic, `${c.title} — ${c.status}${c.action ? ` · ${c.action}` : ""}`)
  }
  if (!i.readinessFromFile) {
    push("inconnu", "base", "état réel de la migration, du schéma installé, des déclencheurs, des rôles, du mode réplique et du privilège TRUNCATE : aucune base lue par cet outil")
    push("inconnu", "couverture", "couverture historique réellement disponible : inconnue tant que la migration n'est appliquée nulle part")
  }
  push("fait_verifie", "exposition", "couverture « complète » = historique lu en entier ET commencé au plus tard au début de la fenêtre ; aucun temps inconnu toléré dans une mesure « fiable » (lib/listing-presence/exposure.ts)")
  for (const t of TESTS_PRESENT) push("resultat_de_test", "tests", `${t} — présent dans le dépôt ; résultat CI à lire sur le commit visé (cet outil ne lit pas la CI)`)
  push("hypothese", "rôles", "le rôle applicatif n'est pas propriétaire de la table et n'a pas TRUNCATE — à constater par le rapport sur la destination (contrôles E)")
  push("risque", "protection", "un propriétaire de table peut DISABLE TRIGGER ; session_replication_role = replica coupe la capture sans erreur : seul le rapprochement après coup (contrôles B/C) le révèle")
  push("risque", "retour arrière", "le rollback de migration SUPPRIME l'historique collecté ; l'arrêt de collecte laisse un trou définitif")
  push("decision", "B", "autoriser (ou non) la migration sur le staging nommé")
  push("decision", "D", "autoriser (ou non) le démarrage de la collecte en production — décision distincte de B")
  push("decision", "E/F", "chaque moteur, chaque mode, une décision écrite à part ; aucune activation ne découle d'une étape réussie")

  const steps = LAUNCH_STEPS.map((s) => ({
    ...s,
    decision:
      s.id === "E" || s.id === "F"
        ? { step: s.id, allowed: false, reasons: ["décision par moteur (voir « moteurs »)"], executesAutomatically: false as const }
        : evaluateStep(s.id, { destination: s.id === "D" ? (i.productionDestination ?? null) : (i.stagingDestination ?? null), auths: i.auths, state: i.state }),
  }))
  const engines = ENGINE_OBSERVE_ORDER.map((engine, idx) => ({
    engine,
    order: idx + 1,
    observe: evaluateStep("E", { engine, auths: i.auths, state: i.state }),
    activate: evaluateStep("F", { engine, auths: i.auths, state: i.state }),
  }))
  return {
    generatedAt: i.now.toISOString(),
    basis: { readiness: i.readinessFromFile ? "fichier_fourni" : "statique", activation: i.activation ? "fichier_fourni" : "absent" },
    evidence: ev,
    steps,
    engines,
    flags: i.flags,
    stops: Object.values(STOP_PROCEDURES),
    observability: OBSERVABILITY_QUESTIONS,
    executesNothing: true,
  }
}

const KIND_LABEL: Record<EvidenceKind, string> = {
  fait_verifie: "FAITS VÉRIFIÉS",
  resultat_de_test: "RÉSULTATS DE TESTS",
  inconnu: "INCONNUS",
  hypothese: "HYPOTHÈSES",
  risque: "RISQUES",
  decision: "DÉCISIONS À PRENDRE",
}

/** Text rendering. Prints only what the sheet holds — never an environment value other than the normalised flags. */
export function formatLaunchDecisionSheet(s: LaunchDecisionSheet): string {
  const out: string[] = [`Fiche de décision — démarrage de la collecte de l'historique — ${s.generatedAt}`, `Base : rapport ${s.basis.readiness}, préparation des moteurs ${s.basis.activation}. Cet outil n'exécute rien.`, ""]
  for (const k of Object.keys(KIND_LABEL) as EvidenceKind[]) {
    const items = s.evidence.filter((e) => e.kind === k)
    if (items.length === 0) continue
    out.push(KIND_LABEL[k])
    for (const e of items) out.push(`  - [${e.topic}] ${e.text}`)
    out.push("")
  }
  out.push("ÉTAPES ET AUTORISATIONS")
  for (const st of s.steps) {
    out.push(`  ${st.id}. ${st.title} — modifie : ${st.modifiesDatabase} — autorisation : ${st.authorization}`)
    out.push(`     possible maintenant : ${st.decision.allowed ? "oui (à exécuter à la main)" : "non"}${st.decision.reasons.length ? ` — ${st.decision.reasons.join(" ; ")}` : ""}`)
    if (st.stop) out.push(`     arrêt : ${STOP_PROCEDURES[st.stop].action}`)
  }
  out.push("", "MOTEURS (ordre d'observation documenté)")
  for (const e of s.engines) {
    out.push(`  ${e.order}. ${e.engine} — observe : ${e.observe.allowed ? "possible" : "non"} (${e.observe.reasons.join(" ; ") || "—"})`)
    out.push(`     on : ${e.activate.allowed ? "possible" : "non"} (${e.activate.reasons.join(" ; ") || "—"})`)
  }
  out.push("", "DRAPEAUX (lus, jamais modifiés)")
  for (const [k, v] of Object.entries(s.flags)) out.push(`  ${k} = ${v}`)
  out.push("", "ARRÊTS — quatre opérations distinctes")
  for (const p of s.stops) out.push(`  ${p.kind} : ${p.action} — données : ${p.dataAffected}${p.losesCollectedData ? " (PERTE)" : ""} — vérifier : ${p.verify}`)
  out.push("", "SUIVI APRÈS DÉMARRAGE (rapports existants)")
  for (const q of s.observability) out.push(`  ${q.question} → ${q.source}`)
  return out.join("\n")
}
