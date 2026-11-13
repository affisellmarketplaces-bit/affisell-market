/**
 * Redis key namespace per environment — Preview and Production never share a key (finalisation master K1).
 *
 * Why: Upstash / the queue Redis are ONE shared instance whose URL can sit in the Vercel Preview environment too. Every key the
 * application writes (`affisell:shield:ban:<ip>`, `rl:…`, `radar:…`, `bull:<queue>:…`) used to carry no environment at all, so a
 * Preview deployment read and wrote production's rate-limit counters, IP bans, OAuth states, cron locks and — worst — the BullMQ
 * queues: a Preview process could enqueue a job that a production worker then executed, or consume one meant for production.
 *
 * The rule — chosen so that NO EXISTING PRODUCTION KEY CHANGES:
 *
 *     production        → ""          (keys exactly as before: `affisell:shield:ban:1.2.3.4`, BullMQ prefix `bull`)
 *     preview           → "preview:"  (`preview:affisell:shield:ban:1.2.3.4`, BullMQ prefix `preview:bull`)
 *     development       → "dev:"      (a developer machine; same instance, still its own keys)
 *     test              → "test:"
 *
 * Production is deliberately the EMPTY namespace: nothing has to be migrated, a rollback of this change leaves production untouched,
 * and the Railway worker (`NODE_ENV=production`, no `VERCEL_ENV`) lands in the production namespace by itself, which is what it needs
 * to consume the queues that Vercel Production produces. A worker that must serve Preview's queues sets
 * `AFFISELL_REDIS_NAMESPACE=preview` (docs/ENVIRONMENTS.md).
 *
 * `AFFISELL_REDIS_NAMESPACE` can only move a runtime AWAY from production: on a Vercel Preview / Development deployment the value
 * "production" is ignored (it would re-create the shared namespace this module exists to prevent). Any other value must be 1–24
 * characters of `a-z 0-9 -`, otherwise it is ignored and the environment decides.
 *
 * Pure: no `server-only`, no Redis client, no I/O. Redis pattern arguments (`KEYS affisell:shield:ban:*`) are prefixed the same way,
 * which is why the namespace alphabet contains no glob character.
 */
import { resolveRuntimeEnvironment } from "@/lib/runtime-environment"

type EnvBag = Record<string, string | undefined>

export const REDIS_NAMESPACE_VARIABLE = "AFFISELL_REDIS_NAMESPACE"

const NAMESPACE_RE = /^[a-z0-9][a-z0-9-]{0,23}$/
const PRODUCTION_ALIASES = new Set(["production", "prod"])

/** BullMQ's own default prefix. Production keeps it, so existing queues (`bull:<queue>:…`) stay where they are. */
export const BULLMQ_DEFAULT_PREFIX = "bull"

/** The namespace WITHOUT its trailing colon: "" (production), "preview", "dev", "test", or a validated explicit value. */
export function redisNamespace(env: EnvBag = process.env): string {
  const runtime = resolveRuntimeEnvironment(env)
  const derived = runtime === "production" ? "" : runtime === "preview" ? "preview" : runtime === "development" ? "dev" : "test"

  const explicit = env[REDIS_NAMESPACE_VARIABLE]?.trim().toLowerCase()
  if (!explicit) return derived
  if (PRODUCTION_ALIASES.has(explicit)) {
    // Only a runtime that is already production (or the self-hosted production worker) may be pinned to the production namespace.
    return runtime === "production" ? "" : derived
  }
  return NAMESPACE_RE.test(explicit) ? explicit : derived
}

/** `preview:` / `dev:` / `test:`, or "" in production — the string put in front of every Redis key. */
export function redisNamespacePrefix(env: EnvBag = process.env): string {
  const ns = redisNamespace(env)
  return ns ? `${ns}:` : ""
}

/** The key (or glob pattern) as stored in Redis for the current environment. Idempotence is NOT assumed: call it once per key. */
export function redisKey(key: string, env: EnvBag = process.env): string {
  return `${redisNamespacePrefix(env)}${key}`
}

/** Value for the `prefix` option of every BullMQ `Queue` / `Worker` / `QueueEvents`: `bull` in production, `preview:bull`… elsewhere. */
export function bullmqPrefix(env: EnvBag = process.env): string {
  return `${redisNamespacePrefix(env)}${BULLMQ_DEFAULT_PREFIX}`
}
