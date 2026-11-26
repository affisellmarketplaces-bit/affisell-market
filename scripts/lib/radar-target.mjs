/**
 * World Radar seed — the PURE decision layer of the gate (RSK-90, lot A).
 *
 * Data in, verdicts out. No file, no environment, no process, no Prisma, no clock: everything here is a function of its arguments,
 * which is what makes every refusal testable without a database. It never creates a token or a client and exports nothing that
 * could (`scripts/radar-seed-run.ts` owns both, privately).
 *
 * Gate, in the order the program applies it (nothing before G8 can touch a database):
 *   G0  strict arguments                                         → exit 2
 *   G1  sources read once; environment sources examined (D5/D6)  → exit 1 / 2 / 3
 *       target resolved once                                     → exit 1 (no target)
 *   G2  URL parsed: strict grammar, ONE parser, closed list of parameters, database name as the engine sends it → exit 3
 *   G3  class ∈ {production, staging, bouclage}; unknown refused → exit 3
 *   G4  class expected by the entry = resolved class             → exit 3
 *   --  every class is DISABLED by its own literal (lot A)       → exit 3 (`radar-seed-run.ts`; nothing below can run in lot A)
 *   G5  proof of intent: the COMPLETE identity (typed, or --expect-identity)       → exit 2 / 3
 *   G6  extra proofs (bouclage, production): ALLOW naming the identity, provenance → exit 2
 *   G7  token (private)   G8  historical guard   G9b generated client's env paths (text, BEFORE it is loaded)
 *   G9  generated client's schema                                                  → exit 3
 *
 * Exit codes — read together with the `state=` field of the last line (exit 4 is shared by two states):
 *   0   verified (reserved: unreachable in lot A, which never reads back what it wrote)
 *   1   configuration / unexpected          2 refused (you did not authorise this target)
 *   3   target not proven (declared ≠ resolved, unknown, malformed, class disabled)
 *   4   seed failed: a read probe failed BEFORE any write (state failed_before_write) or a write failed / the outcome is unknown
 *       after writes began (state indeterminate)
 *   5   verification failed (lot C)         6 executed, NOT verified: every write returned without error, nothing was read back
 *   130 interrupted at the prompt.
 *
 * Nothing in a verdict or a message ever contains a URL, a user name, a password, a parameter VALUE, an ALLOW token or a path:
 * only constant labels, variable NAMES, parameter NAMES (when they look like names), class names and component NAMES ("port", "base"…).
 */
import { normalizeEndpoint } from "../prisma-explicit-db.mjs"
import { classifyDatabaseUrl } from "../schema-deploy.mjs"
import { ALLOW_VARIABLES, GUARDED_VARIABLES, TARGET_VARIABLES } from "./radar-entry-snapshot.mjs"

export { ALLOW_VARIABLES, GUARDED_VARIABLES, TARGET_VARIABLES }

/** The schema the generated Radar client is bound to (every model carries `@@schema("market_intelli")`). */
export const RADAR_SCHEMA = "market_intelli"

/** The three models the seed writes. G9 requires each of them to carry exactly `RADAR_SCHEMA` in the loaded client. */
export const RADAR_MODEL_NAMES = Object.freeze(["RadarCountry", "RadarWinner", "RadarTrendingKeyword"])

export const EXIT = Object.freeze({
  OK: 0,
  CONFIG: 1,
  REFUSED: 2,
  TARGET_UNPROVEN: 3,
  SEED_FAILED: 4,
  VERIFY_FAILED: 5,
  EXECUTED_UNVERIFIED: 6,
  INTERRUPTED: 130,
})

/**
 * What the last line says about the run. Only a final line with `state=refused` proves that nothing was written: an exit code of
 * 130, 143 or 137, or no final line at all once the process went past the prompt, means INDETERMINATE.
 *   refused               no client was created, no connection opened, nothing written (certain)
 *   failed_before_write   the client exists and a connection was attempted, but this program issued no write
 *   executed_unverified   every write returned without an error; nothing was read back
 *   verified              writes and read-back agree (lot C; unreachable in lot A)
 *   indeterminate         a write failed, or an unexpected failure happened after writes began: the state may be partial
 */
export const STATE = Object.freeze({
  REFUSED: "refused",
  FAILED_BEFORE_WRITE: "failed_before_write",
  EXECUTED_UNVERIFIED: "executed_unverified",
  VERIFIED: "verified",
  INDETERMINATE: "indeterminate",
})

/**
 * The state of a finished run, derived in ONE place from what really happened (never from the exit code alone: exit 4 and
 * exit 1 each cover two states).
 * @param {{ clientBuilt: boolean, writeStarted: boolean, exit: number }} input
 * @returns {string}
 */
export function deriveState({ clientBuilt, writeStarted, exit }) {
  if (exit === EXIT.EXECUTED_UNVERIFIED) return STATE.EXECUTED_UNVERIFIED
  if (exit === EXIT.OK) return STATE.VERIFIED
  if (writeStarted) return STATE.INDETERMINATE
  return clientBuilt ? STATE.FAILED_BEFORE_WRITE : STATE.REFUSED
}

/** The limit of every class decision, printed in the banner and repeated in the message of an executed run. One constant, pinned by a test. */
export const TARGET_LIMIT_NOTICE =
  "Classe et identité déduites de l'URL ; serveur réellement joint non vérifié (DNS, /etc/hosts, tunnel possibles) ; aucun contrôle côté serveur dans cette version."

/** What the operator types in front of the identity. "bouclage" is not "local": a loopback address does not prove where the server is. */
export const CLASS_LABEL = Object.freeze({ production: "PRODUCTION", staging: "STAGING", bouclage: "BOUCLAGE" })

/** @typedef {"production" | "staging" | "bouclage"} TargetClass */
/** @typedef {{ provider: "neon" | "pg", endpoint: string, port: number | null, database: string, schema: string }} Identity */
/** @typedef {{ ok: false, exit: number, key: string, message: string }} Refusal */

/** @returns {Refusal} */
function refusal(exit, key, message) {
  return { ok: false, exit, key, message }
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* G0 — arguments                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

const VALUE_OPTIONS = new Set(["--countries", "--expect-class", "--expect-identity"])
const FLAG_OPTIONS = new Set(["--confirm-production", "--confirm-loopback"])

/**
 * Strict: an unknown option, a repeated option, a missing value and an empty or unknown country are all REFUSED. The old seed fell
 * back to every country when `--countries` was invalid.
 * @param {readonly string[]} argv arguments after the script name
 * @param {readonly string[]} knownCodes every country code the seed knows
 * @returns {{ ok: true, options: { countries: string[] | null, expectClass: TargetClass | null, expectIdentity: string | null, confirmProduction: boolean, confirmLoopback: boolean } } | Refusal}
 */
export function parseSeedArgs(argv, knownCodes) {
  const known = new Set(knownCodes)
  /** @type {{ countries: string[] | null, expectClass: TargetClass | null, expectIdentity: string | null, confirmProduction: boolean, confirmLoopback: boolean }} */
  const options = { countries: null, expectClass: null, expectIdentity: null, confirmProduction: false, confirmLoopback: false }
  const seen = new Set()
  const args = argv.filter((a) => a !== "--")

  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i]
    const eq = raw.startsWith("--") ? raw.indexOf("=") : -1
    const name = eq >= 0 ? raw.slice(0, eq) : raw

    if (FLAG_OPTIONS.has(name)) {
      if (eq >= 0) return refusal(EXIT.REFUSED, "flag_with_value", `L'option ${name} ne prend pas de valeur.`)
      if (name === "--confirm-production") options.confirmProduction = true
      else options.confirmLoopback = true
      continue
    }

    if (!VALUE_OPTIONS.has(name)) {
      const printable = /^--[a-z][a-z-]{0,40}$/.test(name) ? `Option inconnue : ${name}.` : "Argument inattendu."
      return refusal(EXIT.REFUSED, "unknown_option", printable)
    }
    if (seen.has(name)) return refusal(EXIT.REFUSED, "duplicate_option", `L'option ${name} est répétée.`)
    seen.add(name)

    let value = eq >= 0 ? raw.slice(eq + 1) : undefined
    if (value === undefined) {
      value = args[i + 1]
      if (value === undefined || value.startsWith("--")) return refusal(EXIT.REFUSED, "missing_value", `L'option ${name} attend une valeur.`)
      i += 1
    }

    if (name === "--countries") {
      const tokens = value.split(",").map((c) => c.trim().toUpperCase())
      if (value.trim() === "" || tokens.some((c) => c === "")) {
        return refusal(EXIT.REFUSED, "countries_invalid", "--countries est vide ou contient un code vide : refusé (aucun repli sur tous les pays).")
      }
      const unknown = tokens.filter((c) => !known.has(c))
      if (unknown.length > 0) {
        return refusal(EXIT.REFUSED, "countries_unknown", `--countries contient ${unknown.length} code(s) inconnu(s) : refusé (aucun repli sur tous les pays).`)
      }
      options.countries = [...new Set(tokens)]
    } else if (name === "--expect-class") {
      if (value !== "production" && value !== "staging" && value !== "bouclage") {
        return refusal(EXIT.REFUSED, "expect_class_invalid", "--expect-class doit valoir production, staging ou bouclage.")
      }
      options.expectClass = value
    } else {
      options.expectIdentity = value
    }
  }
  return { ok: true, options }
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* G1 — resolution                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * Same rule as the application (`lib/radar/env.ts`): the Docker-local Radar database (localhost / 127.0.0.1 on port 5434, or
 * without a port) is SKIPPED when it comes from RADAR_DATABASE_URL or MARKET_INTELLI_DATABASE_URL. It is a selection rule; it says
 * nothing about classification. A parity test compares it with the application's own function.
 * @param {string} url
 */
export function isDockerLocalRadarUrl(url) {
  try {
    const u = new URL(url)
    const host = u.hostname === "localhost" || u.hostname === "127.0.0.1"
    return host && (u.port === "5434" || u.port === "")
  } catch {
    return /localhost:5434|127\.0\.0\.1:5434/.test(url)
  }
}

const DOCKER_SKIPPABLE = new Set(["RADAR_DATABASE_URL", "MARKET_INTELLI_DATABASE_URL"])

/**
 * Resolves the target ONCE from the entry snapshot and the (in-memory) env files. Order of the application: R > M > U > D.
 * Per variable: shell > `.env.local` > `.env`. A variable defined EMPTY counts as absent and is reported, never silently masking.
 * `.env.pre-local-merge.bak` is not a source (the caller reports its variable NAMES only).
 * @param {{ shell: Readonly<Record<string, string | undefined>>, files: ReadonlyArray<{ label: string, values: Readonly<Record<string, string | undefined>> }> }} input files in precedence order
 * @returns {{ ok: true, url: string, variable: string, source: string, ignored: Array<{ variable: string, source: string, why: string, cls: string }>, empty: Array<{ variable: string, source: string }> }
 *   | { ok: false, ignored: Array<{ variable: string, source: string, why: string, cls: string }>, empty: Array<{ variable: string, source: string }> }}
 */
export function resolveTarget({ shell, files }) {
  const sources = [{ label: "shell", values: shell }, ...files]
  /** @type {Array<{ variable: string, source: string }>} */
  const empty = []
  /** @type {Record<string, Array<{ variable: string, source: string, url: string }>>} */
  const perVariable = {}
  for (const variable of TARGET_VARIABLES) {
    perVariable[variable] = []
    for (const source of sources) {
      const raw = source.values?.[variable]
      if (raw === undefined) continue
      const value = String(raw).trim()
      if (value === "") empty.push({ variable, source: source.label })
      else perVariable[variable].push({ variable, source: source.label, url: value })
    }
  }

  /** @type {{ variable: string, source: string, url: string } | null} */
  let chosen = null
  /** @type {Array<{ variable: string, source: string, why: string, url: string }>} */
  const ignoredRaw = []
  for (const variable of TARGET_VARIABLES) {
    const [first, ...rest] = perVariable[variable]
    for (const other of rest) ignoredRaw.push({ ...other, why: "lower_precedence_source" })
    if (!first) continue
    if (chosen) {
      ignoredRaw.push({ ...first, why: "lower_priority_variable" })
    } else if (DOCKER_SKIPPABLE.has(variable) && isDockerLocalRadarUrl(first.url)) {
      ignoredRaw.push({ ...first, why: "docker_local_skipped" })
    } else {
      chosen = first
    }
  }

  const ignored = ignoredRaw.map(({ variable, source, why, url }) => ({ variable, source, why, cls: describeClass(url) }))
  if (!chosen) return { ok: false, ignored, empty }
  return { ok: true, url: chosen.url, variable: chosen.variable, source: chosen.source, ignored, empty }
}

/** Class name of a candidate that was NOT chosen, for the "ignored" report only (never a value). */
function describeClass(url) {
  const analysis = analyzeTargetUrl(url)
  return analysis.ok ? analysis.cls : "illisible"
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* G2 / G3 — URL, identity, class                                                                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

/** `localhost`, `::1` and 127.0.0.0/8 only. `0.0.0.0` and `host.docker.internal` are NOT loopback: they are unknown. */
export function isLoopbackHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    /^127(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(hostname)
  )
}

const DB_SAFE = /[A-Za-z0-9_.-]/

/** Percent-encodes every character outside [A-Za-z0-9_.-] (UTF-8 bytes) so the database name never breaks a token or a phrase. */
function encodeDatabase(name) {
  const bytes = new TextEncoder()
  let out = ""
  for (const ch of name) {
    if (DB_SAFE.test(ch)) out += ch
    else for (const b of bytes.encode(ch)) out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`
  }
  return out
}

/**
 * `<provider>:<endpoint>[:<port>]/<database>#<schema>` — no user, no password, no parameter, no hash.
 * @param {Identity} identity
 */
export function formatIdentity(identity) {
  const port = identity.port === null ? "" : `:${identity.port}`
  return `${identity.provider}:${identity.endpoint}${port}/${encodeDatabase(identity.database)}#${identity.schema}`
}

/**
 * Parses a canonical identity (typed phrase, `--expect-identity`, ALLOW token). Returns null when it is not one.
 * Neon: no port allowed. Anything else: the port is mandatory (a missing one is not "5432 by default" in a proof).
 * @param {string} text
 * @returns {Identity | null}
 */
export function parseIdentity(text) {
  const m = /^(neon|pg):(.+)\/([^/#]+)#([A-Za-z0-9_]+)$/i.exec(String(text).trim())
  if (!m) return null
  const provider = /** @type {"neon" | "pg"} */ (m[1].toLowerCase())
  const hostPort = m[2]
  const v6 = /^(\[[0-9A-Fa-f:.]+\])(?::(\d{1,5}))?$/.exec(hostPort)
  const plain = /^([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(hostPort)
  const parts = v6 ?? plain
  if (!parts) return null
  const host = parts[1].toLowerCase()
  const port = parts[2] === undefined ? null : Number(parts[2])
  if (host === "") return null
  if (provider === "neon") {
    if (port !== null) return null
  } else if (port === null || port < 1 || port > 65535) {
    return null
  }
  let database
  try {
    database = decodeURIComponent(m[3])
  } catch {
    return null
  }
  if (database === "" || database.includes("/")) return null
  return { provider, endpoint: provider === "neon" ? normalizeEndpoint(host) : host, port, database, schema: m[4] }
}

/** Structural equality on the five components: provider and endpoint are case-insensitive (normalised), database and schema are not. */
export function identitiesEqual(a, b) {
  return diffIdentity(a, b).length === 0
}

/** Names (never values) of the components that differ. */
export function diffIdentity(a, b) {
  const names = []
  if (a.provider !== b.provider) names.push("fournisseur")
  if (a.endpoint !== b.endpoint) names.push("endpoint")
  if (a.port !== b.port) names.push("port")
  if (a.database !== b.database) names.push("base")
  if (a.schema !== b.schema) names.push("schéma")
  return names
}

/** Hostname: dot-separated labels of [a-z0-9-], none empty, none starting or ending with a hyphen — or a bracketed IPv6 address. */
const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$|^\[[0-9a-f:.]+\]$/
/** Database name, as the engine sends it: the RAW first path segment (no decoding on its side), so a '%' is refused here. */
const DATABASE_PATH_RE = /^\/[A-Za-z0-9_.-]{1,63}$/
/** The first label of a Neon host is an endpoint id: `ep-` then words/ids, `-pooler` being one more word. */
const NEON_ENDPOINT_LABEL_RE = /^ep-[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Parameters that change WHERE the engine connects. The installed engine honours `host` (it wins over the URL's own host,
 * quaint `url.rs` host()); the others are libpq names it ignores today and a later engine could honour. Refused whatever D2 says.
 */
const DESTINATION_PARAMS = new Set(["host", "hostaddr", "port", "dbname", "service", "user", "password"])

/**
 * The CLOSED list of query parameters (D2: each one observed in the real candidate URLs and verified against the exact engine).
 * `sslmode=require` is mandatory on a Neon host (the engine otherwise falls back to `prefer`, and silently ignores any other value);
 * `channel_binding=require` is optional. Anything else — `connection_limit`, `connect_timeout`, `pgbouncer`, `schema`, `options`… — is refused.
 */
const ALLOWED_PARAMS = Object.freeze({
  sslmode: (value) => value === "require",
  channel_binding: (value) => value === "require",
})

/** A parameter NAME is printed only when it looks like one; a value never is. */
function printableParam(name) {
  return /^[a-z_]{1,32}$/.test(name) ? `« ${name} »` : "au nom illisible"
}

/** `production` / `staging` / everything else, whatever the classifier calls it. */
function branchClass(branch) {
  return branch === "production" || branch === "staging" ? branch : "unknown"
}

/** The shared classifier on a string that WE build, never on the operator's: `postgresql://x@<host>/d`. */
function classifierView(host) {
  try {
    const parsed = classifyDatabaseUrl(`postgresql://x@${host}/d`)
    return { branch: branchClass(parsed.branch), endpoint: parsed.endpoint }
  } catch {
    return { branch: "unknown", endpoint: "" }
  }
}

/**
 * G2 + G3 on the exact string that will be handed to the client.
 *
 * ONE parser decides: the identity and the class both come from the WHATWG `hostname` of the same string. The shared classifier
 * (`classifyDatabaseUrl`, whose host extraction is a regular expression on the first '@' of the WHOLE string, query included) is
 * never fed the raw URL to DECIDE; it is only asked, on the raw string, whether it AGREES (`url_parser_disagreement` otherwise).
 * @param {string} rawUrl
 * @returns {{ ok: true, identity: Identity, cls: TargetClass | "unknown" } | Refusal}
 */
export function analyzeTargetUrl(rawUrl) {
  const raw = String(rawUrl).trim()
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    return refusal(EXIT.TARGET_UNPROVEN, "url_control_characters", "La cible contient un caractère de contrôle : cible non prouvée.")
  }
  let url
  try {
    url = new URL(raw)
  } catch {
    return refusal(EXIT.TARGET_UNPROVEN, "url_unparsable", "URL de cible illisible : cible non prouvée.")
  }
  if (!/^postgres(?:ql)?:$/i.test(url.protocol) || !/^postgres(?:ql)?:\/\//.test(raw)) {
    return refusal(EXIT.TARGET_UNPROVEN, "url_not_postgres", "La cible n'est pas une URL postgres (schéma en minuscules, `//`) : cible non prouvée.")
  }
  if (raw.includes("#")) return refusal(EXIT.TARGET_UNPROVEN, "url_fragment", "L'URL porte un fragment : cible non prouvée.")
  if ((raw.match(/@/g) ?? []).length > 1) {
    return refusal(EXIT.TARGET_UNPROVEN, "url_at_sign", "L'URL contient plus d'un « @ » (identifiants à encoder ?) : cible non prouvée.")
  }
  const hostname = url.hostname.toLowerCase()
  if (hostname === "") return refusal(EXIT.TARGET_UNPROVEN, "url_no_host", "URL sans hôte : cible non prouvée.")
  if (!HOST_RE.test(hostname)) {
    return refusal(EXIT.TARGET_UNPROVEN, "url_host_invalid", "Nom d'hôte hors grammaire (labels [a-z0-9-], pas de point final, pas de virgule) : cible non prouvée.")
  }

  const pathname = url.pathname
  if (pathname === "" || pathname === "/") {
    return refusal(
      EXIT.TARGET_UNPROVEN,
      "url_no_database",
      "URL sans nom de base : cible non prouvée (PostgreSQL le remplacerait par le nom du rôle, on ne devine pas)."
    )
  }
  if (!DATABASE_PATH_RE.test(pathname)) {
    return refusal(EXIT.TARGET_UNPROVEN, "url_database_invalid", "Nom de base hors grammaire ([A-Za-z0-9_.-], 63 au plus, sans encodage) : cible non prouvée.")
  }
  const database = pathname.slice(1)

  const provider = hostname.endsWith(".neon.tech") ? "neon" : "pg"
  if (provider === "neon" && url.port !== "" && url.port !== "5432") {
    return refusal(EXIT.TARGET_UNPROVEN, "url_neon_port", "Port inhabituel pour un hôte Neon (tunnel ou proxy ?) : cible non prouvée.")
  }

  // Query parameters: EVERY entry (never `.get`: the engine keeps the LAST duplicate, `.get` returns the first).
  const seen = new Set()
  for (const [name, value] of url.searchParams) {
    if (DESTINATION_PARAMS.has(name.toLowerCase())) {
      return refusal(EXIT.TARGET_UNPROVEN, "url_param_destination", `Le paramètre ${printableParam(name)} peut changer la destination effective de la connexion : cible non prouvée.`)
    }
    if (seen.has(name)) return refusal(EXIT.TARGET_UNPROVEN, "url_param_duplicate", `Le paramètre ${printableParam(name)} est répété : cible non prouvée.`)
    seen.add(name)
    const check = Object.hasOwn(ALLOWED_PARAMS, name) ? ALLOWED_PARAMS[name] : null
    if (check === null) return refusal(EXIT.TARGET_UNPROVEN, "url_param_not_allowed", `Le paramètre ${printableParam(name)} n'est pas dans la liste fermée : cible non prouvée.`)
    if (!check(value)) return refusal(EXIT.TARGET_UNPROVEN, "url_param_value", `La valeur du paramètre ${printableParam(name)} n'est pas dans la liste acceptée : cible non prouvée.`)
  }

  /** @type {Identity} */
  let identity
  /** @type {TargetClass | "unknown"} */
  let cls
  if (provider === "neon") {
    const label = hostname.split(".")[0]
    if (!NEON_ENDPOINT_LABEL_RE.test(label)) {
      return refusal(EXIT.TARGET_UNPROVEN, "url_neon_endpoint_shape", "Le premier label d'un hôte Neon doit être un identifiant d'endpoint (ep-…) : cible non prouvée.")
    }
    if (!seen.has("sslmode")) {
      return refusal(EXIT.TARGET_UNPROVEN, "url_sslmode_required", "Sur un hôte Neon, « sslmode=require » est obligatoire (sinon repli en clair possible) : cible non prouvée.")
    }
    const endpoint = normalizeEndpoint(label)
    // The class comes from the FIRST LABEL only; the whole host and the raw string must agree with it.
    const byLabel = classifierView(`${label}.aws.neon.tech`)
    const byHost = classifierView(hostname)
    if (byLabel.endpoint !== endpoint || byLabel.branch !== byHost.branch || byLabel.branch !== rawBranchClass(raw)) {
      return refusal(EXIT.TARGET_UNPROVEN, "url_parser_disagreement", "Deux lectures de l'URL ne s'accordent pas sur la classe de la cible : cible non prouvée.")
    }
    identity = { provider, endpoint, port: null, database, schema: RADAR_SCHEMA }
    cls = byLabel.branch
  } else {
    // A non-Neon host can only be loopback or unknown; the shared classifier must not see a production/staging marker in it.
    const rawBranch = rawBranchClass(raw)
    if (rawBranch !== "unknown") {
      return refusal(EXIT.TARGET_UNPROVEN, "url_parser_disagreement", "Deux lectures de l'URL ne s'accordent pas sur la classe de la cible : cible non prouvée.")
    }
    identity = { provider, endpoint: hostname, port: url.port === "" ? 5432 : Number(url.port), database, schema: RADAR_SCHEMA }
    cls = isLoopbackHost(hostname) ? "bouclage" : "unknown"
  }
  return { ok: true, identity, cls }
}

/** What the shared classifier makes of the RAW string (it decides nothing here; it is only compared). */
function rawBranchClass(raw) {
  try {
    return branchClass(classifyDatabaseUrl(raw).branch)
  } catch {
    return "unknown"
  }
}

/**
 * G4 — the class the entry expects (`radar:seed:prod` → production) against the resolved one.
 * @param {TargetClass | null} expected
 * @param {TargetClass | "unknown"} actual
 * @returns {{ ok: true } | Refusal}
 */
export function checkExpectedClass(expected, actual) {
  if (expected === null || expected === actual) return { ok: true }
  return refusal(
    EXIT.TARGET_UNPROVEN,
    "class_mismatch",
    `Cette entrée attend une cible de classe ${CLASS_LABEL[expected]}, la cible résolue est de classe ${actual === "unknown" ? "INCONNUE" : CLASS_LABEL[actual]}.`
  )
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* G5 / G6 — proofs                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * ALLOW tokens. A valid one is a COMPLETE canonical identity. The historical "endpoint only" form is recognised so that the
 * message can say what to do, but it never authorises the seed. Malformed tokens are counted, never echoed.
 * @param {string | undefined} value
 * @returns {{ identities: Identity[], legacy: number, malformed: number }}
 */
export function parseAllowValue(value) {
  /** @type {Identity[]} */
  const identities = []
  let legacy = 0
  let malformed = 0
  for (const token of String(value ?? "").split(/[\s,]+/).filter(Boolean)) {
    if (/[/#]/.test(token)) {
      const identity = parseIdentity(token)
      if (identity) identities.push(identity)
      else malformed += 1
    } else if (/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(token)) {
      legacy += 1
    } else {
      malformed += 1
    }
  }
  return { identities, legacy, malformed }
}

const LOADING_FLAGS = new Map([
  ["--require", "code"],
  ["-r", "code"],
  ["--import", "code"],
  ["--loader", "code"],
  ["--experimental-loader", "code"],
  ["--env-file", "env"],
  ["--env-file-if-exists", "env"],
  ["--eval", "code"],
  ["-e", "code"],
  ["--print", "code"],
  ["-p", "code"],
])

/** `tsx` itself preloads these two files (and nothing that reads an env file); NODE_OPTIONS may name the bare specifiers. */
const TSX_SPECIFIERS = new Set(["tsx", "tsx/esm", "tsx/cjs"])

/** @param {string} value a path or a file: URL */
function toPosixPath(value) {
  let path = value
  if (/^file:/i.test(value)) {
    try {
      path = decodeURIComponent(new URL(value).pathname)
    } catch {
      return ""
    }
  }
  return path.replace(/\\/g, "/")
}

/**
 * Is this (flag, value) one of the preloads `tsx` adds itself, and nothing else? Compared with the real location of `tsx` inside
 * this repository's `node_modules`, so a look-alike file elsewhere does not pass.
 */
function isTsxOwnPreload(flag, value, repoRoot) {
  if (TSX_SPECIFIERS.has(value) && (flag === "--import" || flag === "--require" || flag === "-r")) return true
  const root = toPosixPath(repoRoot).replace(/\/+$/, "")
  const path = toPosixPath(value)
  if (root === "" || !path.startsWith(`${root}/node_modules/`)) return false
  if (flag === "--require" || flag === "-r") return path.endsWith("/tsx/dist/preflight.cjs")
  if (flag === "--import" || flag === "--loader" || flag === "--experimental-loader") return path.endsWith("/tsx/dist/loader.mjs")
  return false
}

/**
 * Node options that load an env file or foreign code into this process — in `process.execArgv` AND in NODE_OPTIONS.
 * `tsx`'s own two preloads are recognised and ignored. Returns flag NAMES and their origin, never a value or a path.
 * @param {{ execArgv: readonly string[], nodeOptions: string, repoRoot: string }} input
 * @returns {Array<{ flag: string, source: "execArgv" | "NODE_OPTIONS", kind: string }>}
 */
export function collectPreloadFindings({ execArgv, nodeOptions, repoRoot }) {
  /** @type {Array<{ flag: string, source: "execArgv" | "NODE_OPTIONS", kind: string }>} */
  const findings = []
  const optionTokens = []
  for (const m of String(nodeOptions ?? "").matchAll(/"([^"]*)"|(\S+)/g)) optionTokens.push(m[1] ?? m[2])

  for (const [source, tokens] of /** @type {const} */ ([
    ["execArgv", execArgv],
    ["NODE_OPTIONS", optionTokens],
  ])) {
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]
      const eq = token.startsWith("--") ? token.indexOf("=") : -1
      const flag = eq > 0 ? token.slice(0, eq) : token
      const kind = LOADING_FLAGS.get(flag)
      if (!kind) continue
      let value = eq > 0 ? token.slice(eq + 1) : tokens[i + 1]
      if (eq <= 0) i += 1
      value = String(value ?? "")
      if (kind === "code" && isTsxOwnPreload(flag, value, repoRoot)) continue
      findings.push({ flag, source, kind })
    }
  }
  return findings
}

/** Variables that change the code or the engine the process runs (DOTENV_KEY is judged apart: it selects ANOTHER env file). */
export const ENGINE_VARIABLES = Object.freeze(GUARDED_VARIABLES.filter((name) => name !== "DOTENV_KEY"))

/**
 * D5 / D6 — environment sources the seed has NOT examined, judged on the entry snapshot and on file TEXT (never on `process.env`
 * after the generated client was required: that module loads `<repo>/.env` by itself, once at require time and once at construction).
 *   1. a foreign preload / `--env-file`           → exit 2  (what it loads cannot be examined)
 *   2. `prisma/.env`, `.env.vault`, DOTENV_KEY    → exit 3  (a file Prisma could read instead of the one examined)
 *   3. a variable that changes the executed code  → exit 3  (PRISMA_QUERY_ENGINE_LIBRARY, DYLD_INSERT_LIBRARIES, LD_PRELOAD…)
 * Only NAMES are carried and printed.
 * @param {{
 *   guarded: Readonly<Record<string, boolean>> | undefined,
 *   preloads: ReadonlyArray<{ flag: string, source: string }>,
 *   existing: readonly string[],
 *   definedInFiles: ReadonlyArray<{ label: string, name: string }>,
 * }} input
 * @returns {{ ok: true } | Refusal}
 */
export function assessEnvSources({ guarded, preloads, existing, definedInFiles }) {
  if (preloads.length > 0) {
    return refusal(
      EXIT.REFUSED,
      "foreign_preload",
      `Options Node qui chargent un fichier d'environnement ou du code (${describePreloads(preloads)}) : ce qu'elles chargent n'est pas examiné par le seed. Relancez sans elles.`
    )
  }
  /** @type {string[]} */
  const unexamined = [...existing]
  if (guarded?.DOTENV_KEY === true) unexamined.push("DOTENV_KEY (shell)")
  for (const file of definedInFiles) if (file.name === "DOTENV_KEY") unexamined.push(`DOTENV_KEY dans ${file.label}`)
  if (unexamined.length > 0) {
    return refusal(
      EXIT.TARGET_UNPROVEN,
      "unexamined_env_source",
      `Source d'environnement non examinée par le seed : ${unexamined.join(", ")}. Le client Prisma pourrait lire autre chose que ce qui a été vérifié : cible non prouvée.`
    )
  }
  /** @type {string[]} */
  const engine = []
  for (const name of ENGINE_VARIABLES) if (guarded?.[name] === true) engine.push(`${name} (shell)`)
  for (const file of definedInFiles) if (ENGINE_VARIABLES.includes(file.name)) engine.push(`${file.name} dans ${file.label}`)
  if (engine.length > 0) {
    return refusal(
      EXIT.TARGET_UNPROVEN,
      "engine_override_variable",
      `Variable qui change le code ou le moteur exécuté : ${engine.join(", ")}. Retirez-la : cible non prouvée.`
    )
  }
  return { ok: true }
}

/** posix path resolution on strings (this module does no I/O and imports no `node:` module). */
function resolvePosix(base, relative) {
  const parts = relative.startsWith("/") ? [] : base.split("/")
  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") {
      if (parts.length > 1) parts.pop()
      continue
    }
    parts.push(segment)
  }
  return parts.join("/") || "/"
}

/**
 * G9b — the generated Radar client says which env files IT will load (`relativeEnvPaths`, frozen when `prisma generate` ran). The
 * text is read BEFORE the module is required, because the module loads `<repo>/.env` as soon as it is required. Accepted: no path
 * at all, or exactly `<repo>/.env`; the datasource must be `db`, read from RADAR_DATABASE_URL, with no inline value. Anything else
 * (another file after a regeneration with a `prisma/.env` present, an unreadable or unrecognised file, another folder) is refused,
 * with a constant label, never a path.
 * @param {{ ok: boolean, text?: string, clientDir?: string, expectedClientDir?: string, repoRoot?: string, schemaBeside?: boolean } | null | undefined} read
 * @returns {{ ok: true } | Refusal}
 */
export function assessEnvLoadPaths(read) {
  /** @param {string} label */
  const refuse = (label) =>
    refusal(EXIT.TARGET_UNPROVEN, "client_env_paths_unproven", `Le client Radar généré ne prouve pas les fichiers d'environnement qu'il charge (${label}) : refus avant son chargement.`)
  if (!read || read.ok !== true) return refuse("fichier illisible")
  const { text, clientDir, expectedClientDir, repoRoot, schemaBeside } = read
  if (typeof text !== "string" || typeof clientDir !== "string" || typeof expectedClientDir !== "string" || typeof repoRoot !== "string") return refuse("lecture incomplète")
  if (clientDir !== expectedClientDir) return refuse("dossier du client inattendu")
  if (schemaBeside !== true) return refuse("schema.prisma absent à côté du client")

  /** @type {unknown} */
  let paths
  try {
    const found = /"relativeEnvPaths"\s*:\s*(\{[^{}]*\})/.exec(text)
    if (!found) return refuse("configuration introuvable")
    paths = JSON.parse(found[1])
  } catch {
    return refuse("configuration illisible")
  }
  const expectedEnv = `${repoRoot}/.env`
  for (const key of ["rootEnvPath", "schemaEnvPath"]) {
    const value = paths !== null && typeof paths === "object" ? /** @type {Record<string, unknown>} */ (paths)[key] : undefined
    if (value === null) continue
    if (typeof value !== "string") return refuse("configuration de forme inattendue")
    if (resolvePosix(clientDir, value) !== expectedEnv) return refuse("fichier d'environnement étranger")
  }

  const names = /"datasourceNames"\s*:\s*\[\s*"db"\s*\]/.test(text)
  const datasource = /"inlineDatasources"\s*:\s*\{\s*"db"\s*:\s*\{\s*"url"\s*:\s*\{\s*"fromEnvVar"\s*:\s*"RADAR_DATABASE_URL"\s*,\s*"value"\s*:\s*null\s*\}\s*\}\s*\}/.test(text)
  if (!names || !datasource) return refuse("source de l'URL inattendue")
  return { ok: true }
}

/**
 * G5 (static part) + G6. Everything that does not need the operator to type anything, in this order:
 *   identity declared with --expect-identity (≠ resolved → 3) · proof available at all (non-interactive without it → 2) ·
 *   bouclage / production: provenance, ALLOW naming the identity, --confirm-* when non-interactive (→ 2).
 * The typed phrase comes last (`assessTypedProof`), so nobody is asked to type before a missing prerequisite is reported.
 *
 * @param {{
 *   cls: TargetClass,
 *   identity: Identity,
 *   expectIdentity: string | null,
 *   interactive: boolean,
 *   confirmProduction: boolean,
 *   confirmLoopback: boolean,
 *   allowProduction: string | undefined,
 *   allowLoopback: string | undefined,
 *   preloads: ReadonlyArray<{ flag: string, source: string }>,
 *   allowDefinedInFiles: ReadonlyArray<{ label: string, name: string }>,
 * }} input
 * @returns {{ ok: true, needsTypedProof: boolean, warnings: string[] } | Refusal}
 */
export function assessStaticProof(input) {
  const { cls, identity } = input
  /** @type {string[]} */
  const warnings = []

  let proven = false
  if (input.expectIdentity !== null) {
    const declared = parseIdentity(input.expectIdentity)
    if (!declared) return refusal(EXIT.TARGET_UNPROVEN, "expect_identity_malformed", "--expect-identity n'est pas une identité canonique (fournisseur:endpoint[:port]/base#schéma).")
    const diff = diffIdentity(declared, identity)
    if (diff.length > 0) {
      return refusal(EXIT.TARGET_UNPROVEN, "expect_identity_mismatch", `L'identité déclarée ne correspond pas à la cible résolue — composant(s) divergent(s) : ${diff.join(", ")}.`)
    }
    proven = true
  } else if (!input.interactive) {
    return refusal(
      EXIT.REFUSED,
      "proof_missing",
      `Hors terminal, la preuve d'intention est obligatoire : passez --expect-identity <identité complète> (classe ${CLASS_LABEL[cls]}). L'identité n'est affichée qu'en terminal interactif.`
    )
  }

  if (cls === "staging") {
    if (input.preloads.length > 0) warnings.push(`Options Node de préchargement détectées (${describePreloads(input.preloads)}) : sans effet sur une cible STAGING, mais non neutres.`)
    return { ok: true, needsTypedProof: !proven, warnings }
  }

  const isProduction = cls === "production"
  const variable = isProduction ? ALLOW_VARIABLES[0] : ALLOW_VARIABLES[1]
  const confirmFlag = isProduction ? "--confirm-production" : "--confirm-loopback"
  const allow = isProduction ? input.allowProduction : input.allowLoopback
  const confirmed = isProduction ? input.confirmProduction : input.confirmLoopback

  if (input.preloads.length > 0) {
    return refusal(
      EXIT.REFUSED,
      "foreign_preload",
      `Options Node qui chargent un fichier d'environnement ou du code (${describePreloads(input.preloads)}) : l'origine de ${variable} ne serait pas prouvable. Relancez sans elles.`
    )
  }
  if (input.allowDefinedInFiles.some((f) => f.name === variable)) {
    return refusal(
      EXIT.REFUSED,
      "allow_defined_in_file",
      `${variable} est définie dans un fichier d'environnement du dépôt (${[...new Set(input.allowDefinedInFiles.filter((f) => f.name === variable).map((f) => f.label))].join(", ")}) : une confirmation ne vaut que saisie dans le shell, pour cette invocation. Retirez-la du fichier.`
    )
  }
  const parsed = parseAllowValue(allow)
  if (!parsed.identities.some((candidate) => identitiesEqual(candidate, identity))) {
    if (parsed.legacy > 0 && parsed.identities.length === 0) {
      return refusal(EXIT.REFUSED, "allow_legacy_endpoint_only", `${variable} ne nomme qu'un endpoint : nommez l'identité complète (fournisseur:endpoint[:port]/base#schéma).`)
    }
    const detail = parsed.malformed > 0 ? ` (${parsed.malformed} jeton(s) mal formé(s) ignoré(s))` : ""
    const key = String(allow ?? "").trim() === "" ? "allow_missing" : "allow_not_naming_identity"
    return refusal(
      EXIT.REFUSED,
      key,
      key === "allow_missing"
        ? `${variable} doit nommer l'identité complète de la cible, dans le shell, pour cette invocation.`
        : `${variable} ne nomme pas l'identité de la cible résolue${detail}.`
    )
  }
  if (!input.interactive && !confirmed) {
    return refusal(EXIT.REFUSED, "confirm_flag_missing", `Hors terminal, ${confirmFlag} est obligatoire en plus de ${variable}.`)
  }
  return { ok: true, needsTypedProof: !proven, warnings }
}

function describePreloads(preloads) {
  return [...new Set(preloads.map((p) => `${p.flag} dans ${p.source}`))].join(", ")
}

/**
 * G5 (typed part): `<CLASS> <complete identity>`, compared structurally. Typing `PROD`, the wrong class, or an identity that differs
 * by ONE component is a refusal.
 * @param {{ identity: Identity, cls: TargetClass, typed: string }} input
 * @returns {{ ok: true } | Refusal}
 */
export function assessTypedProof({ identity, cls, typed }) {
  const text = String(typed ?? "").trim()
  const space = text.search(/\s/)
  const label = space < 0 ? text : text.slice(0, space)
  const declared = space < 0 ? null : parseIdentity(text.slice(space + 1))
  if (label !== CLASS_LABEL[cls] || !declared) {
    return refusal(EXIT.REFUSED, "typed_mismatch", `Saisie refusée : tapez exactement « ${CLASS_LABEL[cls]} <identité complète> » comme affiché.`)
  }
  const diff = diffIdentity(declared, identity)
  if (diff.length > 0) {
    return refusal(EXIT.REFUSED, "typed_mismatch", `Saisie refusée — composant(s) divergent(s) : ${diff.join(", ")}.`)
  }
  return { ok: true }
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Honest results                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * Classifies a database error by its Prisma CODE, never by its text: the old seed matched a regex that contained the model names and
 * exited 0 ("schema not found") on a connection error. A message can carry a host; a code cannot.
 * @param {unknown} err
 * @returns {{ key: "schema_absent" | "schema_outdated" | "connection" | "database_error", code: string | null }}
 */
export function classifySeedError(err) {
  const holder = err && typeof err === "object" ? /** @type {{ code?: unknown, errorCode?: unknown, name?: unknown }} */ (err) : {}
  const raw = typeof holder.code === "string" ? holder.code : typeof holder.errorCode === "string" ? holder.errorCode : null
  const code = raw !== null && /^P\d{4}$/.test(raw) ? raw : null
  if (code === "P2021") return { key: "schema_absent", code }
  if (code === "P2022") return { key: "schema_outdated", code }
  if (code !== null && /^P10(?:0\d|1\d)$/.test(code)) return { key: "connection", code }
  if (holder.name === "PrismaClientInitializationError") return { key: "connection", code }
  return { key: "database_error", code }
}

/**
 * The machine-readable last line of every run: `result=<key> exit=<n> state=<state>`. Read it with an anchored expression; its
 * absence (or an exit of 130, 143, 137 once past the prompt) means INDETERMINATE.
 * @param {string} key
 * @param {number} exit
 * @param {string} state one of STATE
 */
export function formatFinalLine(key, exit, state) {
  return `[seed-world-radar] result=${key} exit=${exit} state=${state}`
}
