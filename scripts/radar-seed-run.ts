/**
 * World Radar seed — the program behind `npm run radar:seed:world` and `npm run radar:seed:prod` (RSK-90, lot A).
 *
 * The ONLY export is `runRadarSeedCli()`: no parameter, no dependency to inject. It is started by `scripts/seed-world-radar.ts`
 * (the bootstrap), which takes the environment snapshot first and imports this file afterwards.
 *
 *   One process, one resolver, one gate, inside the program that writes. The old wrapper (`seed-prod-safe.mjs`) resolved a target,
 *   asked for "PROD", then spawned a child that loaded the env files again with `override: true` and resolved with ANOTHER order:
 *   the target confirmed was not necessarily the target used. Here the URL is resolved once, turned into a canonical identity,
 *   confirmed on that identity, and handed to the client unchanged.
 *
 * ┌─ EVERY CLASS IS DISABLED (lot A) ──────────────────────────────────────────────────────────────────────────────────────────┐
 * │ Three independent literals — `PRODUCTION_SEED_ENABLED`, `LOOPBACK_SEED_ENABLED`, `STAGING_SEED_ENABLED` — are `false`. No    │
 * │ environment variable, no argument, no ALLOW, no complete identity and no confirmation reads or overrides them: a target of    │
 * │ any class is refused (exit 3) BEFORE any prompt, token, client, connection or write — and the token mint and the client       │
 * │ factory refuse it again on their own. In lot A this program cannot write anywhere.                                            │
 * │                                                                                                                              │
 * │ Do NOT flip PRODUCTION_SEED_ENABLED in lot A, B or D. It may be lifted only by a dedicated commit, validated by the owner,    │
 * │ once ALL of this holds (RSK-90 step 8 quinquies, §5):                                                                         │
 * │   1. lot C is delivered, validated by the owner and independently reviewed (S1 server probe, per-country transactions,        │
 * │      run markers, verification, full exit codes);                                                                             │
 * │   2. the concurrency test passes on the dedicated TEST database: two simultaneous replacements of one country leave           │
 * │      exactly N rows, and the "country busy" path is covered;                                                                  │
 * │   3. the application change (the per-country advisory lock in `persistWorldRadarScan`) is deployed to PRODUCTION — the       │
 * │      owner checks that the active deployment carries a commit that contains it;                                               │
 * │   4. the previous deployment has drained (at least the 300 s `maxDuration` plus a margin, then one cron run observed on       │
 * │      the new version through the lock's log line);                                                                            │
 * │   5. the first production seed is restricted to ONE country, then widened.                                                    │
 * │ Do NOT lift LOOPBACK_SEED_ENABLED or STAGING_SEED_ENABLED either: each needs its OWN decision of the owner, taken after lot C │
 * │ (the S1 probe and the lock shared between the application and the seed), never as a side effect of another change.            │
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * What a class decision proves, and what it does not — keep these sentences true:
 *   Une classification STAGING déduite du nom d'hôte ne prouve pas l'identité du serveur réellement joint : une redirection DNS,
 *   une entrée /etc/hosts ou un tunnel restent possibles. Le transport n'authentifie pas non plus le serveur : le moteur accepte par
 *   défaut les certificats invalides, et `sslmode=require` signifie chiffrement, pas identité. Aucun seed réel n'est autorisé sur
 *   cette seule classification : le contrôle serveur du lot C (sonde S1) et le verrou partagé entre l'application et le seed restent
 *   obligatoires.
 *   The identity is the one DECLARED by the URL; the class comes from a fragment of the host name.
 *
 * What a run means (read the `state=` field of the last line; exit 4 is shared by two states):
 *   refused              nothing was created, connected or written                      exits 1, 2, 3, 130 at the prompt
 *   failed_before_write  a connection was attempted, this program issued no write       exit 4 (read probe) · 1 (unexpected)
 *   executed_unverified  every write returned without an error; NOTHING WAS READ BACK   exit 6
 *   indeterminate        a write failed, or an unexpected failure after writes began    exit 4 (the state may be partial)
 *   verified             writes and read-back agree                                     exit 0 — unreachable in lot A
 * Only a final line `state=refused` proves that nothing was written. An exit of 130, 143 or 137, or no final line at all, once the
 * process went past the prompt, means INDETERMINATE: inspect the database. Writes are per statement, not per transaction (lot C):
 * a failure can leave a country emptied. The data written is the built-in demonstration catalogue (mock).
 */
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { WORLD_RADAR_COUNTRIES, getWorldCountry } from "../lib/radar/world-countries"
import { buildMockTrendingForCountry, buildMockWinnersForCountry } from "../lib/radar/world-mock-catalog"
import { WORLD_RADAR_CACHE_TTL_MS } from "../lib/radar/world-radar-types"
import { assertNotProductionByAccident } from "./lib/production-guard.mjs"
import { readEntrySnapshot } from "./lib/radar-entry-snapshot.mjs"
import { askRadarProof, isInteractiveTerminal } from "./lib/radar-prompt.mjs"
import { inspectEnvSurface, readClientConfig, readRadarSources } from "./lib/radar-sources.mjs"
import {
  ALLOW_VARIABLES,
  CLASS_LABEL,
  EXIT,
  RADAR_MODEL_NAMES,
  RADAR_SCHEMA,
  TARGET_LIMIT_NOTICE,
  analyzeTargetUrl,
  assessEnvLoadPaths,
  assessEnvSources,
  assessStaticProof,
  assessTypedProof,
  checkExpectedClass,
  classifySeedError,
  collectPreloadFindings,
  deriveState,
  formatFinalLine,
  formatIdentity,
  identitiesEqual,
  parseSeedArgs,
  resolveTarget,
} from "./lib/radar-target.mjs"

/** Literals on purpose, one per class, independent of each other. See the box above before touching any of them. */
const PRODUCTION_SEED_ENABLED = false
const LOOPBACK_SEED_ENABLED = false
const STAGING_SEED_ENABLED = false

type TargetClass = "production" | "staging" | "bouclage"
type Identity = { provider: "neon" | "pg"; endpoint: string; port: number | null; database: string; schema: string }
type Verdict = { exit: number; key: string; message: string }
/** What really happened so far, local to one run (never module-level state): the state of the last line is derived from it. */
type Run = { clientBuilt: boolean; writeStarted: boolean }

const DISABLED_SUFFIX = "aucune variable, aucun argument, aucune identité et aucune confirmation ne le réactive."
const CLASS_DISABLED_MESSAGE: Record<TargetClass, string> = {
  production: `Le seed de PRODUCTION est désactivé dans cette version (lot A) : ${DISABLED_SUFFIX} Rien n'a été demandé, créé, connecté ni écrit.`,
  bouclage: `Le seed vers une adresse de BOUCLAGE est désactivé dans cette version (lot A) : ${DISABLED_SUFFIX} Rien n'a été demandé, créé, connecté ni écrit.`,
  staging: `Le seed STAGING est désactivé dans cette version (lot A) : ${DISABLED_SUFFIX} Rien n'a été demandé, créé, connecté ni écrit.`,
}
/** Defence in depth (token mint, factory): these sites do not know what was asked before them, so they claim nothing about it. */
const INNER_DISABLED_MESSAGE = "Aucun client n'a été créé, aucune connexion ouverte, rien n'a été écrit : cette classe de cible est désactivée dans cette version (lot A)."

type RadarDb = {
  radarCountry: {
    count: () => Promise<number>
    upsert: (args: {
      where: { code: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }) => Promise<unknown>
  }
  radarWinner: {
    deleteMany: (args: { where: { countryCode: string } }) => Promise<unknown>
    createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>
  }
  radarTrendingKeyword: {
    deleteMany: (args: { where: { countryCode: string } }) => Promise<unknown>
    createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>
  }
  $disconnect: () => Promise<void>
}

type GeneratedRadarClient = {
  PrismaClient: new (args: { datasources: { db: { url: string } }; log: Array<"error" | "warn"> }) => RadarDb
  Prisma?: { dmmf?: { datamodel?: { models?: unknown } } }
}

/** A refusal raised from inside the token mint or the client factory. */
class RefusalSignal extends Error {
  readonly verdict: Verdict
  constructor(verdict: Verdict) {
    super(verdict.key)
    this.name = "RefusalSignal"
    this.verdict = verdict
  }
}

/* ---------------------------------------------------------------------------------------------------------------------- */
/* G7 — the token. Private to this module: not exported, not injectable, no URL on it.                                    */
/* ---------------------------------------------------------------------------------------------------------------------- */

declare const verifiedBrand: unique symbol
type VerifiedTarget = { readonly [verifiedBrand]: true }
type Redeemed = Readonly<{ url: string; identity: Readonly<Identity>; cls: TargetClass }>

/** The URL lives here, keyed by the token object: a copy (spread, structuredClone, JSON, Object.create) is not a key. */
const issued = new WeakMap<object, Redeemed>()

function mintToken(url: string, identity: Identity, cls: TargetClass): VerifiedTarget {
  if (cls === "production" && !PRODUCTION_SEED_ENABLED) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "production_seed_disabled", message: INNER_DISABLED_MESSAGE })
  }
  if (cls === "bouclage" && !LOOPBACK_SEED_ENABLED) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "loopback_seed_disabled", message: INNER_DISABLED_MESSAGE })
  }
  if (cls === "staging" && !STAGING_SEED_ENABLED) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "staging_seed_disabled", message: INNER_DISABLED_MESSAGE })
  }
  const token = Object.freeze(Object.create(null)) as VerifiedTarget
  issued.set(token, Object.freeze({ url, identity: Object.freeze({ ...identity }), cls }))
  return token
}

function redeemTarget(token: VerifiedTarget): Redeemed {
  const redeemed = typeof token === "object" && token !== null ? issued.get(token) : undefined
  if (!redeemed) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "not_a_verified_target", message: "La fabrique du client n'a reçu aucun jeton de cible vérifiée." })
  }
  return redeemed
}

/** G9 — the generated client must be bound to exactly the confirmed schema, for each model the seed writes. */
function assertGeneratedSchema(generated: GeneratedRadarClient): void {
  let models: unknown
  try {
    models = generated.Prisma?.dmmf?.datamodel?.models
  } catch {
    models = undefined
  }
  if (!Array.isArray(models)) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "schema_mismatch", message: "Métadonnées du client Radar généré illisibles : schéma non prouvé." })
  }
  for (const name of RADAR_MODEL_NAMES) {
    const model = models.find((m) => Boolean(m) && typeof m === "object" && (m as { name?: unknown }).name === name) as { schema?: unknown } | undefined
    if (!model || model.schema !== RADAR_SCHEMA) {
      throw new RefusalSignal({
        exit: EXIT.TARGET_UNPROVEN,
        key: "schema_mismatch",
        message: `Le client Radar généré ne porte pas le schéma ${RADAR_SCHEMA} pour le modèle ${name} : schéma non prouvé.`,
      })
    }
  }
}

/**
 * The only place that builds the Radar client of a standalone tool. In order: redeem the token → refuse each disabled class again →
 * the historical guard (G8) → the TEXT of the generated client (G9b, BEFORE it is required: the module loads `<repo>/.env` itself as
 * soon as it is required) → load it → G9 → recompute the identity of the URL it is about to use → pre-set the variable the schema
 * reads to that URL → construct → check that nothing changed it. It has no URL parameter: the URL comes out of the token and nowhere else.
 */
function createRadarDb(token: VerifiedTarget): RadarDb {
  const { url, identity, cls } = redeemTarget(token)
  if (cls === "production" && !PRODUCTION_SEED_ENABLED) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "production_seed_disabled", message: INNER_DISABLED_MESSAGE })
  }
  if (cls === "bouclage" && !LOOPBACK_SEED_ENABLED) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "loopback_seed_disabled", message: INNER_DISABLED_MESSAGE })
  }
  if (cls === "staging" && !STAGING_SEED_ENABLED) {
    throw new RefusalSignal({ exit: EXIT.TARGET_UNPROVEN, key: "staging_seed_disabled", message: INNER_DISABLED_MESSAGE })
  }
  assertNotProductionByAccident("scripts/seed-world-radar.ts", {
    env: { RADAR_DATABASE_URL: url, ...(cls === "production" ? { [ALLOW_VARIABLES[0]]: identity.endpoint } : {}) },
    urlVariables: ["RADAR_DATABASE_URL"],
  })
  // The generated client is CommonJS and its path (".prisma/…") is not a valid ESM specifier, so it is loaded with a `require` made
  // here: whether a bare `require` exists in a module imported dynamically under tsx cannot be proven statically.
  const nodeRequire = createRequire(import.meta.url)
  const envPaths = assessEnvLoadPaths(readClientConfig(nodeRequire.resolve(".prisma/client-mi"), resolve(fileURLToPath(new URL("..", import.meta.url)))))
  if (!envPaths.ok) throw new RefusalSignal(envPaths)
  const generated = nodeRequire(".prisma/client-mi") as GeneratedRadarClient
  const { PrismaClient } = generated
  assertGeneratedSchema(generated)
  const again = analyzeTargetUrl(url)
  if (!again.ok || again.cls !== cls || !identitiesEqual(again.identity, identity)) {
    throw new RefusalSignal({
      exit: EXIT.TARGET_UNPROVEN,
      key: "identity_drift",
      message: "L'identité recalculée au moment de créer le client diffère de celle qui a été confirmée : arrêt.",
    })
  }
  // Both mechanisms carry the SAME value: the explicit override below and the variable the schema reads. Prisma loads `<repo>/.env`
  // without overriding a defined variable, so neither the engine's override precedence nor another value in that file can change the destination.
  process.env.RADAR_DATABASE_URL = url
  const client = new PrismaClient({ datasources: { db: { url } }, log: ["error", "warn"] })
  if (process.env.RADAR_DATABASE_URL !== url) {
    throw new RefusalSignal({
      exit: EXIT.TARGET_UNPROVEN,
      key: "identity_drift",
      message: "La variable lue par le schéma a changé pendant la construction du client : arrêt.",
    })
  }
  return client
}

/* ---------------------------------------------------------------------------------------------------------------------- */
/* Writes — unchanged in substance from the previous seed (per statement, not transactional: lot C), honest about failures. */
/* ---------------------------------------------------------------------------------------------------------------------- */

async function seedCountries(db: RadarDb): Promise<number> {
  let upserted = 0
  for (const c of WORLD_RADAR_COUNTRIES) {
    await db.radarCountry.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name, flag: c.flag, region: c.region, currency: c.currency, enabled: c.enabled },
      update: { name: c.name, flag: c.flag, region: c.region, currency: c.currency, enabled: c.enabled },
    })
    upserted += 1
  }
  return upserted
}

type CountryResult = { country: string; winners: number; trending: number; ok: boolean; failure?: string }

async function seedCountryWinners(db: RadarDb, countryCode: string): Promise<CountryResult> {
  const code = countryCode.toUpperCase()
  const scannedAt = new Date()
  const expiresAt = new Date(scannedAt.getTime() + WORLD_RADAR_CACHE_TTL_MS)
  const winners = buildMockWinnersForCountry(code, 20)
  const trending = buildMockTrendingForCountry(code)
  const def = getWorldCountry(code)

  try {
    await db.radarWinner.deleteMany({ where: { countryCode: code } })
    await db.radarTrendingKeyword.deleteMany({ where: { countryCode: code } })

    if (winners.length > 0) {
      await db.radarWinner.createMany({
        data: winners.map((w) => ({
          countryCode: w.countryCode,
          rank: w.rank,
          title: w.title,
          image: w.image,
          source: w.source,
          price: w.price,
          currency: w.currency,
          growthRate: w.growthRate,
          searches: w.searches,
          competition: w.competition,
          trendingScore: w.trendingScore,
          category: w.category,
          expiresAt,
        })),
      })
    }

    if (trending.length > 0) {
      await db.radarTrendingKeyword.createMany({
        data: trending.map((t) => ({
          countryCode: t.countryCode,
          keyword: t.keyword,
          growthRate: t.growthRate,
          volume: t.volume,
          expiresAt,
        })),
      })
    }

    await db.radarCountry.upsert({
      where: { code },
      create: {
        code,
        name: def?.name ?? code,
        flag: def?.flag ?? "🌍",
        region: def?.region ?? "Europe",
        currency: def?.currency ?? "EUR",
        lastScanAt: scannedAt,
        productCount: winners.length,
      },
      update: { lastScanAt: scannedAt, productCount: winners.length },
    })

    console.log(`[WORLD] ${code} : ${winners.length} gagnants envoyés, écriture acquittée sans erreur (non relue)`)
    return { country: code, winners: winners.length, trending: trending.length, ok: true }
  } catch (err) {
    const failure = classifySeedError(err)
    // Never the error text: it can carry a host. The Prisma code and the class are enough.
    console.error("[seed-world-radar]", { event: "country_failed", country: code, failure: failure.key, code: failure.code })
    return { country: code, winners: 0, trending: 0, ok: false, failure: failure.key }
  }
}

const PROBE_MESSAGES: Record<string, string> = {
  schema_absent: "Le schéma market_intelli est absent de la base cible. Aucune écriture n'a eu lieu. Le créer relève de `npm run radar:db:push`, à autoriser séparément.",
  schema_outdated: "Le schéma market_intelli de la base cible est périmé (colonne absente). Aucune écriture n'a eu lieu.",
  connection: "Connexion à la base cible impossible ou interrompue. Aucune écriture n'a eu lieu.",
  database_error: "La sonde de lecture a échoué (erreur de base). Aucune écriture n'a eu lieu.",
}

/** Everything that happens once the client exists. It returns a verdict; the caller disconnects, then reports. */
async function runWrites(db: RadarDb, run: Run, countryCodes: string[]): Promise<Verdict> {
  console.log("[seed-world-radar]", { event: "start", countries: countryCodes.length, list: countryCodes.join(",") })

  try {
    await db.radarCountry.count()
  } catch (err) {
    const failure = classifySeedError(err)
    return { exit: EXIT.SEED_FAILED, key: failure.key, message: `${PROBE_MESSAGES[failure.key]}${failure.code ? ` (code ${failure.code})` : ""}` }
  }

  // From here a write may be issued — and a write that throws may already be committed: the flag precedes the call.
  run.writeStarted = true
  let registry: number
  try {
    registry = await seedCountries(db)
  } catch (err) {
    const failure = classifySeedError(err)
    return {
      exit: EXIT.SEED_FAILED,
      key: "registry_failed",
      message: `Échec de l'écriture du registre des pays (${failure.key}${failure.code ? `, code ${failure.code}` : ""}). Le registre peut être partiellement mis à jour ; aucun remplacement de pays n'avait commencé. État indéterminé.`,
    }
  }
  console.log("[seed-world-radar]", { event: "countries_registry", count: registry })

  const results: CountryResult[] = []
  for (const code of countryCodes) results.push(await seedCountryWinners(db, code))
  const failed = results.filter((r) => !r.ok)
  console.log("[seed-world-radar]", { event: "countries_acknowledged", ok: results.length - failed.length, total: results.length })

  if (failed.length > 0) {
    return {
      exit: EXIT.SEED_FAILED,
      key: "write_failed",
      message: `Échec pour ${failed.length} pays sur ${results.length} : ${failed.map((r) => r.country).join(", ")}. Les autres pays sont écrits, non vérifiés ; un pays en échec peut être vide ou partiel : les écritures ne sont pas transactionnelles dans cette version. État indéterminé. Relancez (idempotent).`,
    }
  }
  return {
    exit: EXIT.EXECUTED_UNVERIFIED,
    key: "executed_unverified",
    message: `${results.length} pays envoyés, toutes les requêtes acquittées sans erreur. Rien n'a été relu : le contenu de la base n'est PAS vérifié (écritures non transactionnelles). Code 6 = écrit, non vérifié. Catalogue écrit : données de démonstration (mock). ${TARGET_LIMIT_NOTICE}`,
  }
}

/* ---------------------------------------------------------------------------------------------------------------------- */
/* Orchestration                                                                                                          */
/* ---------------------------------------------------------------------------------------------------------------------- */

/** Prints the verdict and the machine-readable last line (both on stderr, whatever the state) and returns the exit code. */
function finish(run: Run, verdict: Verdict): number {
  const state = deriveState({ clientBuilt: run.clientBuilt, writeStarted: run.writeStarted, exit: verdict.exit })
  console.error(`[seed-world-radar] ${verdict.message}`)
  console.error(formatFinalLine(verdict.key, verdict.exit, state))
  return verdict.exit
}

async function execute(run: Run): Promise<number> {
  const snapshot = readEntrySnapshot()
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
  const knownCodes = WORLD_RADAR_COUNTRIES.map((c) => c.code)
  const enabledCodes = WORLD_RADAR_COUNTRIES.filter((c) => c.enabled).map((c) => c.code)

  // G0 — strict arguments
  const parsed = parseSeedArgs(snapshot.argv, knownCodes)
  if (!parsed.ok) return finish(run, parsed)
  const options = parsed.options

  // G1 — sources read once; the environment sources the seed has NOT examined are refused (D5 / D6) before anything is resolved
  const sources = readRadarSources(root)
  if (sources.unreadable.length > 0) {
    return finish(run, { exit: EXIT.CONFIG, key: "source_unreadable", message: `Fichier d'environnement illisible (${sources.unreadable.join(", ")}) : arrêt, la cible ne peut pas être prouvée.` })
  }
  const preloads = collectPreloadFindings({ execArgv: snapshot.execArgv, nodeOptions: snapshot.nodeOptions, repoRoot: root })
  const surface = inspectEnvSurface(root)
  const envSources = assessEnvSources({
    guarded: snapshot.guarded,
    preloads,
    existing: surface.existing,
    definedInFiles: sources.files.flatMap((f) => f.guardedNames.map((name) => ({ label: f.label, name }))),
  })
  if (!envSources.ok) return finish(run, envSources)
  if (surface.unreadEnvFiles.length > 0) {
    console.log(`[seed-world-radar] fichiers .env.* présents mais non lus par le seed : ${surface.unreadEnvFiles.join(", ")}`)
  }
  const resolved = resolveTarget({
    shell: snapshot.env,
    files: sources.files.filter((f) => f.resolution).map((f) => ({ label: f.label, values: f.values })),
  })
  for (const e of resolved.empty) console.warn(`[seed-world-radar] variable vide traitée comme absente : ${e.variable} (${e.source})`)
  for (const o of resolved.ignored) console.log(`[seed-world-radar] ignorée : ${o.variable} (${o.source}) → classe ${o.cls} [${o.why}]`)
  for (const f of sources.files.filter((file) => !file.resolution && file.definedTargetNames.length > 0)) {
    console.warn(`[seed-world-radar] ${f.label} n'est pas une source : variables-cibles ignorées : ${f.definedTargetNames.join(", ")}`)
  }
  if (!resolved.ok) {
    return finish(run, {
      exit: EXIT.CONFIG,
      key: "no_target",
      message: "Aucune cible : RADAR_DATABASE_URL, MARKET_INTELLI_DATABASE_URL, DATABASE_URL_UNPOOLED et DATABASE_URL sont absentes, vides ou ignorées (local Docker 5434). Aucun repli silencieux.",
    })
  }
  console.log(`[seed-world-radar] cible retenue : ${resolved.variable} (source : ${resolved.source})`)

  // G2 / G3 — URL, identity, class
  const analysis = analyzeTargetUrl(resolved.url)
  if (!analysis.ok) return finish(run, analysis)
  if (analysis.cls === "unknown") {
    return finish(run, {
      exit: EXIT.TARGET_UNPROVEN,
      key: "unknown_class",
      message: "Hôte non reconnu (ni production, ni staging, ni bouclage) : refusé sans dérogation. Rien n'a été demandé, créé, connecté ni écrit.",
    })
  }
  const { identity } = analysis
  const cls: TargetClass = analysis.cls

  // G4 — the class this entry expects
  const expected = checkExpectedClass(options.expectClass, cls)
  if (!expected.ok) return finish(run, expected)

  // Every class is disabled: refused here, before any prompt, however many proofs are present.
  if (cls === "production" && !PRODUCTION_SEED_ENABLED) {
    return finish(run, { exit: EXIT.TARGET_UNPROVEN, key: "production_seed_disabled", message: CLASS_DISABLED_MESSAGE.production })
  }
  if (cls === "bouclage" && !LOOPBACK_SEED_ENABLED) {
    return finish(run, { exit: EXIT.TARGET_UNPROVEN, key: "loopback_seed_disabled", message: CLASS_DISABLED_MESSAGE.bouclage })
  }
  if (cls === "staging" && !STAGING_SEED_ENABLED) {
    return finish(run, { exit: EXIT.TARGET_UNPROVEN, key: "staging_seed_disabled", message: CLASS_DISABLED_MESSAGE.staging })
  }

  // G5 (static) / G6 — proof of intent on the COMPLETE identity, extra proofs for bouclage / production
  const interactive = isInteractiveTerminal()
  const proof = assessStaticProof({
    cls,
    identity,
    expectIdentity: options.expectIdentity,
    interactive,
    confirmProduction: options.confirmProduction,
    confirmLoopback: options.confirmLoopback,
    allowProduction: snapshot.env[ALLOW_VARIABLES[0]],
    allowLoopback: snapshot.env[ALLOW_VARIABLES[1]],
    preloads,
    allowDefinedInFiles: sources.files.flatMap((f) => f.allowNames.map((name) => ({ label: f.label, name }))),
  })
  if (!proof.ok) return finish(run, proof)
  for (const warning of proof.warnings) console.warn(`[seed-world-radar] ${warning}`)

  const countryCodes = options.countries ?? enabledCodes
  console.log("")
  console.log("═══════════════════════════════════════════════════")
  console.log("  WORLD RADAR — SEED")
  console.log("═══════════════════════════════════════════════════")
  console.log(`  Classe (d'après le nom d'hôte, serveur réel non prouvé) : ${CLASS_LABEL[cls]}`)
  if (interactive) console.log(`  Identité (d'après l'URL) : ${formatIdentity(identity)}`)
  else console.log("  Identité : non affichée hors terminal interactif")
  console.log(`  Pays     : ${countryCodes.length}`)
  console.log("  Données écrites : catalogue de démonstration (mock), non vérifié après écriture.")
  console.log(`  Attention : ${TARGET_LIMIT_NOTICE}`)
  console.log("═══════════════════════════════════════════════════")
  console.log("")

  if (proof.needsTypedProof) {
    const answer = await askRadarProof(`Pour continuer, tapez exactement : ${CLASS_LABEL[cls]} ${formatIdentity(identity)}\n> `)
    if (answer.kind === "aborted") return finish(run, { exit: EXIT.INTERRUPTED, key: "interrupted", message: "Interrompu à l'invite. Rien n'a été créé, connecté ni écrit." })
    if (answer.kind === "closed") {
      return finish(run, { exit: EXIT.REFUSED, key: "prompt_closed", message: "Entrée fermée avant toute confirmation : refusé. Rien n'a été créé, connecté ni écrit." })
    }
    const typed = assessTypedProof({ identity, cls, typed: answer.text })
    if (!typed.ok) return finish(run, typed)
  }

  // G7 — token · G8 — historical guard · G9b / G9 — generated client · then the client (all inside createRadarDb)
  let db: RadarDb
  try {
    db = createRadarDb(mintToken(resolved.url, identity, cls))
  } catch (err) {
    if (err instanceof RefusalSignal) return finish(run, err.verdict)
    throw err
  }
  run.clientBuilt = true

  let verdict: Verdict
  try {
    verdict = await runWrites(db, run, countryCodes)
  } finally {
    await db.$disconnect().catch(() => undefined)
  }
  return finish(run, verdict)
}

export async function runRadarSeedCli(): Promise<number> {
  const run: Run = { clientBuilt: false, writeStarted: false }
  try {
    return await execute(run)
  } catch (err) {
    if (err instanceof RefusalSignal) return finish(run, err.verdict)
    if (err instanceof Error && err.message === "entry_not_bootstrapped") {
      return finish(run, { exit: EXIT.CONFIG, key: "entry_not_bootstrapped", message: "Point d'entrée non initialisé : lancez le seed par scripts/seed-world-radar.ts (npm run radar:seed:world)." })
    }
    const name = err instanceof Error ? err.name : "inconnue"
    if (run.writeStarted) {
      return finish(run, { exit: EXIT.SEED_FAILED, key: "unexpected_after_start", message: `Erreur inattendue (${name}) après le début des écritures : état indéterminé, inspectez la base.` })
    }
    return finish(run, { exit: EXIT.CONFIG, key: "unexpected", message: `Erreur inattendue (${name}) avant toute écriture.` })
  }
}
