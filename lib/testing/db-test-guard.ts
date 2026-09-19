/**
 * Safety harness for tests that WRITE to a real database.
 *
 * Rule: a DB test may only ever run against a dedicated test database (e.g. a Neon branch) whose
 * connection string lives in `.env.test.local` as DATABASE_URL_TEST. Any URL that points at the same
 * server endpoint as a production/staging URL found in the repo env files is refused.
 */
import fs from "node:fs"
import path from "node:path"

/** Neon endpoint id (ep-xxx), ignoring the "-pooler" suffix; other hosts → full hostname. */
export function dbEndpointOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (!host) return null
    return host.split(".")[0]!.replace(/-pooler$/, "") + "@" + host.split(".").slice(1).join(".")
  } catch {
    return null
  }
}

export type GuardResult = { ok: true; endpoint: string } | { ok: false; reason: string }

export function assessTestDatabaseUrl(testUrl: string | undefined, protectedUrls: Array<string | undefined>): GuardResult {
  const url = testUrl?.trim()
  if (!url) return { ok: false, reason: "DATABASE_URL_TEST is missing (put it in .env.test.local)." }
  if (!/^postgres(ql)?:\/\//i.test(url)) return { ok: false, reason: "DATABASE_URL_TEST is not a postgres URL." }
  const endpoint = dbEndpointOf(url)
  if (!endpoint) return { ok: false, reason: "DATABASE_URL_TEST could not be parsed." }
  for (const p of protectedUrls) {
    if (p && dbEndpointOf(p) === endpoint) {
      return { ok: false, reason: `DATABASE_URL_TEST points at a protected database (${endpoint}). Use a dedicated branch.` }
    }
  }
  return { ok: true, endpoint }
}

/** Minimal dotenv reader (no expansion) — we never want to mutate process.env from prod files. */
export function readEnvFile(file: string): Record<string, string> {
  try {
    const out: Record<string, string> = {}
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim()
      if (!line || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      if (eq < 1) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      out[key] = val
    }
    return out
  } catch {
    return {}
  }
}

/** Always protected: production. */
const PROTECTED_KEYS = ["DATABASE_URL", "DIRECT_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"]
/** Protected unless `.env.test.local` explicitly sets DB_TEST_ALLOW_STAGING=1 (staging branch used as the test DB). */
const STAGING_KEY = "DATABASE_URL_STAGING"

/**
 * Point this process at the test database, or throw. Call BEFORE anything imports `@/lib/prisma`.
 * Returns the endpoint used (for logging).
 */
export function useTestDatabase(root = process.cwd()): string {
  const testEnv = readEnvFile(path.join(root, ".env.test.local"))
  const allowStaging = testEnv.DB_TEST_ALLOW_STAGING === "1"
  const keys = allowStaging ? PROTECTED_KEYS : [...PROTECTED_KEYS, STAGING_KEY]
  const protectedUrls: Array<string | undefined> = []
  for (const f of [".env", ".env.local", ".env.production.local", ".env.development.local"]) {
    const env = readEnvFile(path.join(root, f))
    for (const k of keys) protectedUrls.push(env[k])
  }
  for (const k of keys) protectedUrls.push(process.env[k])

  const verdict = assessTestDatabaseUrl(testEnv.DATABASE_URL_TEST, protectedUrls)
  if (!verdict.ok) {
    throw new Error(
      `[db-test-guard] Refusing to run DB tests: ${verdict.reason}\n` +
        "Create a Neon branch, then add DATABASE_URL_TEST=<branch url> to .env.test.local."
    )
  }
  const url = testEnv.DATABASE_URL_TEST!.trim()
  for (const k of [...PROTECTED_KEYS, STAGING_KEY]) delete process.env[k]
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = testEnv.DIRECT_URL_TEST?.trim() || url
  return verdict.endpoint
}

/** True only when the caller explicitly opted in. */
export function dbTestsRequested(env: Record<string, string | undefined> = process.env): boolean {
  return env.RUN_DB_TESTS === "1"
}
