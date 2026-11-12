/**
 * Entry snapshot of the World Radar seed — a LEAF module (no import at all) and the ONLY file of the seed that reads `process.env`.
 *
 * Why it exists (RSK-90, lot A): the seed's authority variables — the four database-URL candidates and the two `AFFISELL_ALLOW_*`
 * confirmations — must be read BEFORE anything that could change them. The generated Radar client loads a `.env` file of its own
 * at construction, and the old seed loaded three env files with `override: true` in its module body. `scripts/seed-world-radar.ts`
 * (the bootstrap) has no static import: it imports this leaf dynamically, takes the snapshot, and only then imports the program.
 * Everything after that reads this frozen object, never `process.env`.
 *
 * What it can and cannot prove — keep this sentence true: the snapshot says what the environment of THIS process was when the
 * bootstrap started. It cannot say whether a variable was typed for this invocation, exported by a shell profile, injected by a
 * parent process or preloaded by `node --env-file` upstream. The per-invocation intent is carried by the typed phrase (TTY) or by
 * `--expect-identity` (argv), never by an inherited variable alone.
 */

/** The four candidates for the database URL, in the order the application itself resolves them (R > M > U > D). */
export const TARGET_VARIABLES = Object.freeze([
  "RADAR_DATABASE_URL",
  "MARKET_INTELLI_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_URL",
])

/** The two confirmations, each worth only if it names the COMPLETE identity of the resolved target. */
export const ALLOW_VARIABLES = Object.freeze(["AFFISELL_ALLOW_PRODUCTION_WRITES", "AFFISELL_ALLOW_LOOPBACK_WRITES"])

/**
 * Variables whose mere PRESENCE is refused (D5 / D6): they select another env file (`DOTENV_KEY` → `.env.vault`) or change the code
 * the process runs (the native engine library, an injected shared library). Only a boolean per name is kept — never a value:
 * `DOTENV_KEY` is a decryption secret.
 */
export const GUARDED_VARIABLES = Object.freeze([
  "DOTENV_KEY",
  "PRISMA_QUERY_ENGINE_LIBRARY",
  "PRISMA_QUERY_ENGINE_BINARY",
  "PRISMA_CLIENT_ENGINE_TYPE",
  "DYLD_INSERT_LIBRARIES",
  "LD_PRELOAD",
])

/** @type {Readonly<{ env: Readonly<Record<string, string | undefined>>, guarded: Readonly<Record<string, boolean>>, nodeOptions: string, execArgv: readonly string[], argv: readonly string[] }> | null} */
let slot = null

/**
 * Reads the process ONCE, right now. No parameter, no return value: nothing can be injected and nothing leaks to the caller.
 * Calling it again simply replaces the snapshot with the current state (tests do; the bootstrap calls it exactly once).
 */
export function captureEntrySnapshot() {
  /** @type {Record<string, string | undefined>} */
  const env = {}
  for (const name of [...TARGET_VARIABLES, ...ALLOW_VARIABLES]) env[name] = process.env[name]
  /** @type {Record<string, boolean>} */
  const guarded = {}
  for (const name of GUARDED_VARIABLES) guarded[name] = process.env[name] !== undefined
  slot = Object.freeze({
    env: Object.freeze(env),
    guarded: Object.freeze(guarded),
    nodeOptions: String(process.env.NODE_OPTIONS ?? ""),
    execArgv: Object.freeze([...process.execArgv]),
    argv: Object.freeze(process.argv.slice(2)),
  })
}

/** The frozen snapshot. Throws when the bootstrap did not take it: the program refuses to run without it. */
export function readEntrySnapshot() {
  if (slot === null) throw new Error("entry_not_bootstrapped")
  return slot
}
