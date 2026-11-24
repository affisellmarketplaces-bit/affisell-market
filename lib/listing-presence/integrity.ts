/**
 * Presence History Readiness & Integrity Kit (founder brief 2026-11-24, portfolio row 42). PURE.
 *
 * Says, on verifiable evidence, whether the listing presence history can START a reliable collection: schema as
 * installed vs as expected, capture mechanisms (triggers present, correct, enabled), the two known bypasses (TRUNCATE,
 * `session_replication_role = replica`), integrity of what was recorded, and volumes vs the five engines' thresholds.
 *
 * Statuses: PASS (verified) · WARN (risk or limit) · BLOCKED (an indispensable condition is absent) · UNKNOWN (could
 * not be verified with the access available). The global result is never PASS while a CRITICAL check is not PASS.
 * Absence of data is never zero: an unread volume is `null` and its check is UNKNOWN.
 */

export const PRESENCE_MIGRATION_NAME = "20261124090000_listing_presence_history"
export const PRESENCE_TABLE = "ListingPresenceEvent"
/** Same cap as the engines' read (`PRESENCE_MAX_EVENTS` in presence.server.ts, server-only there). */
export const READINESS_MAX_EVENTS = 200_000

export const EXPECTED_COLUMNS = ["id", "affiliateProductId", "affiliateId", "productId", "kind", "previousListed", "newListed", "source", "actorId", "effectiveAt"] as const
export const EXPECTED_CONSTRAINTS = [
  "ListingPresenceEvent_pkey",
  "ListingPresenceEvent_kind_check",
  "ListingPresenceEvent_shape_check",
  "ListingPresenceEvent_source_check",
  "ListingPresenceEvent_actor_check",
] as const
export const EXPECTED_INDEXES = [
  "ListingPresenceEvent_affiliateProductId_id_idx",
  "ListingPresenceEvent_productId_effectiveAt_idx",
  "ListingPresenceEvent_affiliateId_effectiveAt_idx",
] as const

export type ExpectedTrigger = {
  name: string
  table: string
  fn: string
  /** Tokens that MUST appear in `pg_get_triggerdef` (order-free). */
  tokens: readonly string[]
  /** Tokens that must NOT appear (e.g. a wrong timing). */
  forbidden: readonly string[]
  /** Tokens that must appear in the function body (`pg_proc.prosrc`). */
  bodyTokens: readonly string[]
  role: string
}

export const EXPECTED_TRIGGERS: readonly ExpectedTrigger[] = [
  {
    name: "AffiliateProduct_listing_presence_history",
    table: "AffiliateProduct",
    fn: "affisell_record_listing_presence",
    tokens: ["AFTER", "INSERT", "DELETE", 'UPDATE OF "isListed"', "FOR EACH ROW"],
    forbidden: ["BEFORE", "INSTEAD OF", "FOR EACH STATEMENT", "WHEN"],
    bodyTokens: ['INSERT INTO "ListingPresenceEvent"', "IS DISTINCT FROM", "'unattributed'", "clock_timestamp() AT TIME ZONE 'UTC'"],
    role: "capture (création, publication, retrait, remise en vente, suppression)",
  },
  {
    name: "ListingPresenceEvent_append_only",
    table: "ListingPresenceEvent",
    fn: "affisell_listing_presence_append_only",
    tokens: ["BEFORE", "UPDATE", "DELETE", "FOR EACH ROW"],
    forbidden: ["AFTER", "FOR EACH STATEMENT", "WHEN"],
    bodyTokens: ["affisell.listing_presence_purge", "RAISE EXCEPTION"],
    role: "ajout seul (UPDATE refusé, DELETE seulement sous purge déclarée)",
  },
  {
    name: "ListingPresenceEvent_no_truncate",
    table: "ListingPresenceEvent",
    fn: "affisell_listing_presence_no_truncate",
    tokens: ["BEFORE", "TRUNCATE", "FOR EACH STATEMENT"],
    forbidden: ["AFTER", "FOR EACH ROW"],
    bodyTokens: ["affisell.listing_presence_truncate", "RAISE EXCEPTION"],
    role: "refus de TRUNCATE",
  },
] as const

export type CheckStatus = "PASS" | "WARN" | "BLOCKED" | "UNKNOWN"
export type CheckSection = "A_schema" | "B_capture" | "C_integrite" | "D_volumes" | "E_protection"
export type Check = {
  id: string
  section: CheckSection
  title: string
  status: CheckStatus
  critical: boolean
  executed: boolean
  evidence: string[]
  action?: string
}

/** Static facts read from the repository (no database). */
export type StaticFacts = {
  migrationFilePresent: boolean
  migrationSql: string | null
  rollbackSql: string | null
}

/** What `pg_trigger.tgenabled` says: O = origin (normal), D = disabled, R = fires ONLY in replica, A = always. */
export type TriggerState = { name: string; table: string; enabled: "O" | "D" | "R" | "A" | string; definition: string; functionBody: string | null }

/** Catalog facts read in a READ ONLY transaction. `null` = not read (no access / error). */
export type CatalogFacts = {
  migrationRow: "applied" | "rolled_back" | "failed" | "absent" | "unreadable"
  migrationFinishedAt: Date | null
  tableExists: boolean
  columns: string[]
  constraints: string[]
  indexes: string[]
  triggers: TriggerState[]
  /** This report's own session value (other sessions' values are NOT visible in PostgreSQL). */
  sessionReplicationRole: string | null
  /** Role / database defaults that set session_replication_role (pg_db_role_setting). null = unreadable. */
  replicaDefaults: number | null
  /** Whether the connected role may SET session_replication_role (PG ≥ 15, has_parameter_privilege). null = unknown. */
  roleMaySetReplicationRole: boolean | null
  roleIsSuperuser: boolean | null
  roleOwnsTable: boolean | null
  roleHasTruncate: boolean | null
}

/** Integrity counts (aggregates; `null` = not computed). */
export type IntegrityFacts = {
  events: number
  truncated: boolean
  byKind: Record<string, number>
  bySource: Record<string, number>
  futureEvents: number
  beforeTrackingStart: number | null
  chainBreaks: number
  createdNotFirst: number
  afterDeleted: number
  orderInversions: number
  duplicates: number
  orphanListings: number
  deletedButPresent: number
  stateMismatches: number
  createdWithoutEvent: number | null
  attributionMismatches: number
  preExistingListings: number | null
  reintroducedPairs: number
  relistings: number
  /** Newest `effectiveAt` (UTC) — the monitor's freshness / « no new observation » signal. Optional: older readers. */
  newestEventAt?: Date | null
  /** Share of the events carried by the single busiest reseller (0–1) and the number of resellers seen. */
  topResellerEventShare?: number | null
  resellersWithEvents?: number
}

/** Volumes (from the engines' own period rebuild). `null` = not computed. */
export type VolumeFacts = {
  listingsWithHistory: number
  products: number
  resellers: number
  completePeriods: number
  ongoingPeriods: number
  unjudgedPeriods: number
  periodsWithSale: number
  censoredPeriods: number
  historyDays: number | null
}

export type EngineLine = { id: string; name: string; level: number; levelLabel: string; state: string; mainGap: string | null }

export type ReadinessInput = {
  now: Date
  staticFacts: StaticFacts
  /** null = no database read (static run, or the destination was refused). */
  catalog: CatalogFacts | null
  integrity: IntegrityFacts | null
  volumes: VolumeFacts | null
  engines: EngineLine[] | null
  databaseNotReadReason: string | null
}

export type GlobalStatus = CheckStatus

/** The raw facts behind the checks, COUNTS ONLY (no identifier, no free text) — what the collection monitor compares. */
export type ReadinessFactsExport = {
  migrationRow: CatalogFacts["migrationRow"]
  migrationFinishedAt: string | null
  tableExists: boolean
  triggers: Array<{ name: string; enabled: string; defects: number }>
  sessionReplicationRole: string | null
  replicaDefaults: number | null
  roleOwnsTable: boolean | null
  roleHasTruncate: boolean | null
  integrity: (Omit<IntegrityFacts, "newestEventAt"> & { newestEventAt: string | null }) | null
}

/** Which database the report read — the destination classification, never a URL. Filled by the script. */
export type ReadinessTarget = { branch: "production" | "staging" | "local" | "unknown"; endpoint: string }

export type PresenceReadinessReport = {
  generatedAt: string
  global: GlobalStatus
  summary: string
  checks: Check[]
  executed: string[]
  notExecuted: string[]
  anomalies: string[]
  risks: string[]
  actions: string[]
  engines: EngineLine[] | null
  collectionConditions: string[]
  volumes: VolumeFacts | null
  limits: readonly string[]
  facts?: ReadinessFactsExport | null
  target?: ReadinessTarget | null
}

const has = (s: string, token: string) => s.toUpperCase().includes(token.toUpperCase())
/** pg_get_triggerdef names the function schema-qualified or not; compare on the bare name. */
const fnOf = (def: string) => def.match(/EXECUTE (?:FUNCTION|PROCEDURE)\s+(?:[\w"]+\.)?"?([\w]+)"?\s*\(/i)?.[1] ?? null

/** Is an installed trigger the expected one? Returns the list of defects (empty = correct). */
export function triggerDefects(expected: ExpectedTrigger, t: TriggerState | undefined): string[] {
  if (!t) return ["absent"]
  const out: string[] = []
  if (t.table !== expected.table) out.push(`sur la table ${t.table}, attendu ${expected.table}`)
  for (const tok of expected.tokens) if (!has(t.definition, tok)) out.push(`définition sans « ${tok} »`)
  for (const tok of expected.forbidden) if (has(t.definition, ` ${tok} `)) out.push(`définition avec « ${tok} » (inattendu)`)
  if (expected.name === "AffiliateProduct_listing_presence_history") {
    const updateOf = t.definition.match(/UPDATE OF ([^]*?) ON /i)?.[1] ?? ""
    if (updateOf && updateOf.replace(/\s/g, "") !== '"isListed"') out.push(`UPDATE OF ${updateOf.trim()} (attendu "isListed" seul)`)
  }
  const fn = fnOf(t.definition)
  if (fn !== expected.fn) out.push(`fonction ${fn ?? "illisible"}, attendue ${expected.fn}`)
  if (t.functionBody === null) out.push("corps de la fonction introuvable")
  else for (const tok of expected.bodyTokens) if (!t.functionBody.includes(tok)) out.push(`fonction sans « ${tok} »`)
  return out
}

const ENABLED_LABEL: Record<string, string> = { O: "actif (mode normal)", D: "DÉSACTIVÉ", R: "actif SEULEMENT en mode réplique", A: "actif toujours (même en réplique)" }

/** Static checks of the repository's migration and rollback (no database). */
export function staticChecks(s: StaticFacts): Check[] {
  const out: Check[] = []
  const sql = s.migrationSql ?? ""
  out.push({
    id: "A1_migration_file",
    section: "A_schema",
    title: "Migration présente et correctement référencée",
    status: s.migrationFilePresent && sql.length > 0 ? "PASS" : "BLOCKED",
    critical: true,
    executed: true,
    evidence: [s.migrationFilePresent ? `prisma/migrations/${PRESENCE_MIGRATION_NAME}/migration.sql présent` : "fichier de migration absent"],
  })
  if (sql) {
    const missing = [
      ...EXPECTED_COLUMNS.filter((c) => !sql.includes(`"${c}"`)).map((c) => `colonne ${c}`),
      ...EXPECTED_CONSTRAINTS.filter((c) => !sql.includes(`"${c}"`)).map((c) => `contrainte ${c}`),
      ...EXPECTED_INDEXES.filter((c) => !sql.includes(`"${c}"`)).map((c) => `index ${c}`),
      ...EXPECTED_TRIGGERS.filter((t) => !sql.includes(`"${t.name}"`) || !sql.includes(`${t.fn}()`)).map((t) => `déclencheur ${t.name}`),
    ]
    const backfill = /INSERT INTO "ListingPresenceEvent"[\s\S]*SELECT[\s\S]*FROM "AffiliateProduct"/.test(sql)
    out.push({
      id: "A2_migration_content",
      section: "A_schema",
      title: "La migration décrit tout le schéma attendu, sans historique simulé",
      status: missing.length === 0 && !backfill ? "PASS" : "BLOCKED",
      critical: true,
      executed: true,
      evidence: [
        missing.length === 0 ? `${EXPECTED_COLUMNS.length} colonnes, ${EXPECTED_CONSTRAINTS.length} contraintes, ${EXPECTED_INDEXES.length} index, ${EXPECTED_TRIGGERS.length} déclencheurs décrits` : `manque : ${missing.join(", ")}`,
        backfill ? "remplissage rétroactif détecté (historique inventé)" : "aucun remplissage rétroactif",
      ],
    })
  }
  const rb = s.rollbackSql ?? ""
  const rbOk = Boolean(rb) && EXPECTED_TRIGGERS.every((t) => rb.includes(`"${t.name}"`)) && rb.includes(`DROP TABLE IF EXISTS "${PRESENCE_TABLE}"`)
  out.push({
    id: "A3_rollback",
    section: "A_schema",
    title: "Retour arrière documenté et complet",
    status: rbOk ? "PASS" : "WARN",
    critical: false,
    executed: true,
    evidence: [rbOk ? "le script de retour arrière retire les trois déclencheurs et la table" : "script de retour arrière absent ou incomplet"],
  })
  return out
}

function catalogChecks(c: CatalogFacts, now: Date): Check[] {
  const out: Check[] = []
  const applied = c.migrationRow === "applied"
  out.push({
    id: "A4_migration_applied",
    section: "A_schema",
    title: "Migration appliquée (lu dans _prisma_migrations)",
    status: applied ? "PASS" : "BLOCKED",
    critical: true,
    executed: c.migrationRow !== "unreadable",
    evidence: [
      {
        applied: `appliquée${c.migrationFinishedAt ? ` le ${c.migrationFinishedAt.toISOString().slice(0, 10)}` : ""}`,
        rolled_back: "marquée annulée (rolled back)",
        failed: "en échec (non terminée) — à résoudre avant toute collecte",
        absent: "non appliquée",
        unreadable: "historique des migrations illisible",
      }[c.migrationRow],
    ],
    action: applied ? undefined : "décision fondateur : appliquer la migration (staging d'abord, schema:migrate puis schema:verify)",
  })
  if (c.migrationRow === "unreadable") out[out.length - 1]!.status = "UNKNOWN"
  if (!c.tableExists) {
    out.push({ id: "A5_table", section: "A_schema", title: `Table ${PRESENCE_TABLE}`, status: "BLOCKED", critical: true, executed: true, evidence: ["table absente"] })
  } else {
    const missingCols = EXPECTED_COLUMNS.filter((x) => !c.columns.includes(x))
    const extraCols = c.columns.filter((x) => !(EXPECTED_COLUMNS as readonly string[]).includes(x))
    out.push({
      id: "A5_table",
      section: "A_schema",
      title: `Table ${PRESENCE_TABLE} et champs attendus`,
      status: missingCols.length ? "BLOCKED" : extraCols.length ? "WARN" : "PASS",
      critical: true,
      executed: true,
      evidence: [missingCols.length ? `colonnes manquantes : ${missingCols.join(", ")}` : `${EXPECTED_COLUMNS.length} colonnes attendues présentes`, ...(extraCols.length ? [`colonnes en plus : ${extraCols.join(", ")}`] : [])],
    })
    const missingCons = EXPECTED_CONSTRAINTS.filter((x) => !c.constraints.includes(x))
    const missingIdx = EXPECTED_INDEXES.filter((x) => !c.indexes.includes(x))
    out.push({
      id: "A6_constraints_indexes",
      section: "A_schema",
      title: "Index et contraintes",
      status: missingCons.length ? "BLOCKED" : missingIdx.length ? "WARN" : "PASS",
      critical: true,
      executed: true,
      evidence: [
        missingCons.length ? `contraintes manquantes : ${missingCons.join(", ")}` : `${EXPECTED_CONSTRAINTS.length} contraintes présentes`,
        missingIdx.length ? `index manquants (lectures plus lentes) : ${missingIdx.join(", ")}` : `${EXPECTED_INDEXES.length} index présents`,
      ],
    })
    if (!applied) out.push({ id: "A7_schema_without_record", section: "A_schema", title: "Schéma installé hors procédure", status: "WARN", critical: false, executed: true, evidence: ["la table existe mais la migration n'est pas enregistrée comme appliquée : schéma installé à la main ou par db push"], action: "appliquer par schema:migrate, jamais à la main" })
  }
  for (const exp of EXPECTED_TRIGGERS) {
    const t = c.triggers.find((x) => x.name === exp.name)
    const defects = triggerDefects(exp, t)
    const capture = exp.name === "AffiliateProduct_listing_presence_history"
    const state = t ? ENABLED_LABEL[t.enabled] ?? `état ${t.enabled}` : null
    const disabled = t && (t.enabled === "D" || t.enabled === "R")
    out.push({
      id: `B_${exp.name}`,
      section: exp.table === "AffiliateProduct" ? "B_capture" : "E_protection",
      title: `Déclencheur ${exp.name} — ${exp.role}`,
      status: defects.length || disabled ? "BLOCKED" : "PASS",
      critical: true,
      executed: true,
      evidence: [defects.length ? (defects[0] === "absent" ? "absent" : `présent mais incorrect : ${defects.join(" ; ")}`) : "présent et conforme", ...(state ? [state] : [])],
      action: defects.length || disabled ? (capture ? "réappliquer la migration (idempotente) puis relancer ce rapport ; ne PAS commencer la collecte" : "réappliquer la migration (idempotente)") : undefined,
    })
  }
  // Replication role — the trigger can not see that it is silenced; only the settings and the data can tell.
  const roleNow = c.sessionReplicationRole
  out.push({
    id: "E_replication_role",
    section: "E_protection",
    title: "Mode réplication (session_replication_role)",
    status: c.replicaDefaults === null || roleNow === null ? "UNKNOWN" : c.replicaDefaults > 0 || roleNow !== "origin" ? "BLOCKED" : c.roleMaySetReplicationRole || c.roleIsSuperuser ? "WARN" : "PASS",
    critical: true,
    executed: c.replicaDefaults !== null,
    evidence: [
      roleNow === null ? "valeur de la session du rapport illisible" : `session du rapport : ${roleNow}`,
      c.replicaDefaults === null ? "réglages par défaut des rôles / de la base illisibles" : c.replicaDefaults > 0 ? `${c.replicaDefaults} réglage(s) par défaut mettent un rôle ou la base en mode réplique : la capture serait muette pour ces connexions` : "aucun rôle ni base réglé par défaut en mode réplique",
      c.roleIsSuperuser ? "le rôle connecté est superutilisateur : il peut passer en mode réplique pour sa session" : c.roleMaySetReplicationRole ? "le rôle connecté peut régler session_replication_role pour sa session" : c.roleMaySetReplicationRole === false ? "le rôle connecté ne peut pas régler session_replication_role" : "droit de régler session_replication_role inconnu",
      "les sessions des AUTRES connexions ne sont pas visibles dans PostgreSQL : seul le rapprochement des données (section C) révèle une capture muette après coup",
    ],
    action: c.replicaDefaults && c.replicaDefaults > 0 ? "retirer le réglage par défaut (ALTER ROLE … RESET session_replication_role) — décision fondateur" : undefined,
  })
  out.push({
    id: "E_owner_privileges",
    section: "E_protection",
    title: "Qui peut contourner les protections",
    status: c.roleOwnsTable === null ? "UNKNOWN" : c.roleOwnsTable || c.roleIsSuperuser ? "WARN" : "PASS",
    critical: false,
    executed: c.roleOwnsTable !== null,
    evidence: [
      c.roleOwnsTable ? "le rôle connecté possède la table : il peut désactiver les déclencheurs (ALTER TABLE … DISABLE TRIGGER)" : c.roleOwnsTable === false ? "le rôle connecté ne possède pas la table" : "propriétaire illisible",
      c.roleHasTruncate ? "le rôle a le droit TRUNCATE : le déclencheur de refus est la seule barrière" : c.roleHasTruncate === false ? "le rôle n'a pas le droit TRUNCATE" : "droit TRUNCATE inconnu",
    ],
    action: c.roleOwnsTable ? "protection complémentaire proposée : rôle applicatif distinct du rôle propriétaire (migrations), sans TRUNCATE — décision d'infrastructure" : undefined,
  })
  void now
  return out
}

function integrityChecks(f: IntegrityFacts, trackingKnown: boolean): Check[] {
  const out: Check[] = []
  const hardAnomalies = f.futureEvents + (f.beforeTrackingStart ?? 0) + f.chainBreaks + f.createdNotFirst + f.afterDeleted + f.duplicates + f.orphanListings + f.deletedButPresent + f.attributionMismatches
  const captureGaps = f.stateMismatches + (f.createdWithoutEvent ?? 0)
  const kinds = ["created", "listed", "unlisted", "deleted"]
  const seen = kinds.filter((k) => (f.byKind[k] ?? 0) > 0)
  out.push({
    id: "B_capture_observed",
    section: "B_capture",
    title: "Capture observée dans les données réelles",
    status: f.events === 0 ? "UNKNOWN" : captureGaps === 0 && f.createdWithoutEvent !== null ? (seen.length === kinds.length ? "PASS" : "WARN") : captureGaps > 0 ? "BLOCKED" : "UNKNOWN",
    critical: true,
    executed: f.events > 0,
    evidence: [
      f.events === 0 ? "aucun événement enregistré : la capture n'a pas encore pu être observée" : `${f.events} événements ; types observés : ${seen.join(", ") || "aucun"}`,
      ...(kinds.filter((k) => !seen.includes(k)).length && f.events > 0 ? [`types pas encore observés : ${kinds.filter((k) => !seen.includes(k)).join(", ")} (aucun changement de ce type, ou capture absente)`] : []),
      `écarts entre l'état des annonces et le dernier événement : ${f.stateMismatches}`,
      f.createdWithoutEvent === null ? "annonces créées après le début sans événement « created » : non calculable" : `annonces créées après le début sans événement « created » : ${f.createdWithoutEvent}`,
    ],
    action: captureGaps > 0 ? "capture muette à un moment (déclencheur désactivé, mode réplique ou restauration) : identifier la fenêtre, ne pas inventer les événements" : undefined,
  })
  out.push({
    id: "B_idempotence",
    section: "B_capture",
    title: "Idempotence et absence de doublons",
    status: f.events === 0 ? "UNKNOWN" : f.duplicates === 0 ? "PASS" : "BLOCKED",
    critical: true,
    executed: f.events > 0,
    evidence: [`doublons exacts (même annonce, même transition, même instant) : ${f.duplicates}`, "mécanisme prouvé en CI sur PostgreSQL réel (listing-presence-db, presence-readiness-db)"],
  })
  out.push({
    id: "C_sequences",
    section: "C_integrite",
    title: "Séquences, dates et frontières",
    status: f.events === 0 ? "UNKNOWN" : hardAnomalies === 0 ? (f.orderInversions > 0 ? "WARN" : "PASS") : "BLOCKED",
    critical: true,
    executed: f.events > 0,
    evidence: [
      `chaînes rompues (l'état précédent d'un événement ≠ l'état d'après le précédent) : ${f.chainBreaks}`,
      `« created » qui n'est pas le premier événement : ${f.createdNotFirst}`,
      `événements après une suppression : ${f.afterDeleted}`,
      `événements datés dans le futur : ${f.futureEvents}`,
      trackingKnown ? `événements antérieurs au début de l'historique : ${f.beforeTrackingStart ?? 0}` : "début de l'historique inconnu : antériorité non vérifiée",
      `ordre d'écriture ≠ ordre des dates (horloge) : ${f.orderInversions}`,
    ],
  })
  out.push({
    id: "C_orphans_isolation",
    section: "C_integrite",
    title: "Événements orphelins et isolation entre revendeurs",
    status: f.events === 0 ? "UNKNOWN" : f.orphanListings + f.deletedButPresent + f.attributionMismatches === 0 ? "PASS" : "BLOCKED",
    critical: true,
    executed: f.events > 0,
    evidence: [
      `annonces disparues sans événement « deleted » (TRUNCATE, capture muette) : ${f.orphanListings}`,
      `annonces marquées supprimées mais toujours présentes : ${f.deletedButPresent}`,
      `événements attribués à un autre revendeur ou produit que l'annonce : ${f.attributionMismatches}`,
    ],
  })
  const unattributed = f.events > 0 ? (f.bySource.unattributed ?? 0) / f.events : null
  out.push({
    id: "C_attribution",
    section: "C_integrite",
    title: "Événements non attribués à une source",
    status: unattributed === null ? "UNKNOWN" : unattributed > 0.2 ? "WARN" : "PASS",
    critical: false,
    executed: unattributed !== null,
    evidence: [unattributed === null ? "aucun événement" : `${Math.round(unattributed * 1000) / 10} % « unattributed » (seeds, scripts, écrivains non déclarés)`],
  })
  out.push({
    id: "C_unknown_edges",
    section: "C_integrite",
    title: "Historique incomplet et frontières inconnues (attendu, jamais inventé)",
    status: "PASS",
    critical: false,
    executed: true,
    evidence: [
      f.preExistingListings === null ? "annonces antérieures à l'historique : non calculable" : `${f.preExistingListings} annonces antérieures à l'historique : début de période inconnu, jamais jugées`,
      `produits réintroduits par un même revendeur (nouvelle annonce après suppression) : ${f.reintroducedPairs}`,
      `remises en vente enregistrées : ${f.relistings}`,
    ],
  })
  if (f.truncated) out.push({ id: "D_read_cap", section: "D_volumes", title: "Lecture plafonnée", status: "WARN", critical: false, executed: true, evidence: [`plus de ${READINESS_MAX_EVENTS} événements : les moteurs ne produiront aucun constat tant que la lecture est tronquée`] })
  return out
}

function volumeChecks(v: VolumeFacts | null, engines: EngineLine[] | null): Check[] {
  if (!v) return [{ id: "D_volumes", section: "D_volumes", title: "Volumes pour les cinq moteurs", status: "UNKNOWN", critical: false, executed: false, evidence: ["volumes non calculés (historique absent ou illisible) — inconnus, pas zéro"] }]
  return [
    {
      id: "D_volumes",
      section: "D_volumes",
      title: "Volumes pour les cinq moteurs",
      status: engines && engines.some((e) => e.level >= 3) ? "PASS" : "WARN",
      critical: false,
      executed: true,
      evidence: [
        `historique : ${v.historyDays === null ? "durée inconnue" : `${v.historyDays} jours`}`,
        `${v.listingsWithHistory} annonces, ${v.products} produits, ${v.resellers} revendeurs`,
        `périodes complètes ${v.completePeriods}, en cours ${v.ongoingPeriods}, non jugées (bornes inconnues) ${v.unjudgedPeriods}`,
        `périodes avec vente observée ${v.periodsWithSale}, censurées (sans vente) ${v.censoredPeriods}`,
        ...(engines ?? []).map((e) => `${e.name} : niveau ${e.level} (${e.levelLabel}), ${e.state}${e.mainGap ? ` — ${e.mainGap}` : ""}`),
      ],
    },
  ]
}

export const READINESS_KIT_LIMITS = [
  "lecture seule : la capture n'est pas exercée sur la base lue ; le mécanisme est prouvé en CI sur PostgreSQL réel, son fonctionnement réel par la cohérence des données",
  "un déclencheur ne peut pas détecter qu'il est lui-même désactivé : désactivation et mode réplique se voient dans l'état des déclencheurs et, après coup, par le rapprochement annonces ↔ historique",
  "les réglages des sessions des autres connexions ne sont pas lisibles dans PostgreSQL",
  "le propriétaire de la table peut désactiver toute protection : la barrière restante est la séparation des rôles (infrastructure)",
  "les drapeaux des moteurs ne sont pas lus ici (ils vivent sur le déploiement) : statut des moteurs calculé comme s'ils étaient à off",
  "aucune donnée personnelle ni identifiant : agrégats seulement",
] as const

export const COLLECTION_CONDITIONS = [
  "décision fondateur écrite d'appliquer la migration (collecte seulement)",
  "ce rapport sans BLOCKED sur la base cible avant ET après application",
  "les trois déclencheurs présents, conformes et actifs (mode normal)",
  "aucun rôle ni base réglé par défaut en mode réplique",
  "rapprochement annonces ↔ historique à zéro écart après les premiers changements réels",
  "les cinq drapeaux des moteurs maintenus à off",
] as const

export function buildPresenceReadinessReport(input: ReadinessInput): PresenceReadinessReport {
  const checks: Check[] = [...staticChecks(input.staticFacts)]
  if (input.catalog) {
    checks.push(...catalogChecks(input.catalog, input.now))
    if (input.integrity) checks.push(...integrityChecks(input.integrity, Boolean(input.catalog.migrationFinishedAt)))
    else if (input.catalog.tableExists)
      checks.push({ id: "C_integrite", section: "C_integrite", title: "Intégrité de l'historique", status: "UNKNOWN", critical: true, executed: false, evidence: ["non calculée"] })
    checks.push(...volumeChecks(input.volumes, input.engines))
  } else {
    const reason = input.databaseNotReadReason ?? "aucune base lue"
    for (const [id, section, title] of [
      ["A4_migration_applied", "A_schema", "Migration appliquée"],
      ["A5_table", "A_schema", "Schéma réellement installé"],
      ["B_capture_triggers", "B_capture", "Déclencheurs de capture présents, conformes et actifs"],
      ["E_replication_role", "E_protection", "Mode réplication"],
      ["C_integrite", "C_integrite", "Intégrité de l'historique"],
      ["D_volumes", "D_volumes", "Volumes pour les cinq moteurs"],
    ] as const)
      checks.push({ id, section, title, status: "UNKNOWN", critical: section !== "D_volumes", executed: false, evidence: [`non exécuté : ${reason}`] })
  }
  const critical = checks.filter((c) => c.critical)
  const global: GlobalStatus = critical.some((c) => c.status === "BLOCKED")
    ? "BLOCKED"
    : critical.some((c) => c.status === "UNKNOWN")
      ? "UNKNOWN"
      : checks.some((c) => c.status === "WARN" || c.status === "BLOCKED")
        ? "WARN"
        : "PASS"
  const summary = {
    BLOCKED: "Collecte NON prête : au moins une condition indispensable est absente.",
    UNKNOWN: "Collecte non attestée : au moins une vérification critique n'a pas pu être réalisée.",
    WARN: "Collecte possible sous réserve des risques signalés.",
    PASS: "Toutes les vérifications réalisées sont conformes.",
  }[global]
  return {
    generatedAt: input.now.toISOString(),
    global,
    summary,
    checks,
    executed: checks.filter((c) => c.executed).map((c) => c.id),
    notExecuted: checks.filter((c) => !c.executed).map((c) => c.id),
    anomalies: checks.filter((c) => c.status === "BLOCKED").map((c) => `${c.title} : ${c.evidence.join(" ; ")}`),
    risks: checks.filter((c) => c.status === "WARN").map((c) => `${c.title} : ${c.evidence.join(" ; ")}`),
    actions: [...new Set(checks.map((c) => c.action).filter((x): x is string => Boolean(x)))],
    engines: input.engines,
    collectionConditions: [...COLLECTION_CONDITIONS],
    volumes: input.volumes,
    limits: READINESS_KIT_LIMITS,
    facts: input.catalog
      ? {
          migrationRow: input.catalog.migrationRow,
          migrationFinishedAt: input.catalog.migrationFinishedAt ? input.catalog.migrationFinishedAt.toISOString() : null,
          tableExists: input.catalog.tableExists,
          triggers: EXPECTED_TRIGGERS.map((e) => {
            const t = input.catalog!.triggers.find((x) => x.name === e.name)
            return { name: e.name, enabled: t ? t.enabled : "absent", defects: triggerDefects(e, t).length }
          }),
          sessionReplicationRole: input.catalog.sessionReplicationRole,
          replicaDefaults: input.catalog.replicaDefaults,
          roleOwnsTable: input.catalog.roleOwnsTable,
          roleHasTruncate: input.catalog.roleHasTruncate,
          integrity: input.integrity ? { ...input.integrity, newestEventAt: input.integrity.newestEventAt ? input.integrity.newestEventAt.toISOString() : null } : null,
        }
      : null,
  }
}

const ICON: Record<CheckStatus, string> = { PASS: "PASS   ", WARN: "WARN   ", BLOCKED: "BLOCKED", UNKNOWN: "UNKNOWN" }

/** Human-readable text. Aggregates only by construction (the report carries no identifier). */
export function formatPresenceReadiness(r: PresenceReadinessReport): string {
  const lines: string[] = [`RÉSULTAT GLOBAL : ${r.global} — ${r.summary}`, ""]
  const sections: Array<[CheckSection, string]> = [
    ["A_schema", "A. Schéma"],
    ["B_capture", "B. Capture des événements"],
    ["C_integrite", "C. Intégrité et qualité"],
    ["D_volumes", "D. Volumes"],
    ["E_protection", "E. Protections (TRUNCATE, réplication, droits)"],
  ]
  for (const [sec, label] of sections) {
    const cs = r.checks.filter((c) => c.section === sec)
    if (!cs.length) continue
    lines.push(label)
    for (const c of cs) {
      lines.push(`  [${ICON[c.status]}] ${c.title}${c.critical ? " (critique)" : ""}${c.executed ? "" : " — non exécutée"}`)
      for (const e of c.evidence) lines.push(`             · ${e}`)
    }
    lines.push("")
  }
  if (r.actions.length) lines.push("Actions recommandées", ...r.actions.map((a) => `  - ${a}`), "")
  lines.push("Conditions pour commencer la collecte", ...r.collectionConditions.map((a) => `  - ${a}`), "")
  lines.push("Limites", ...r.limits.map((a) => `  - ${a}`))
  return lines.join("\n")
}
