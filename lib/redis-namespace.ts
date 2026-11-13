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
 * and a worker host that sets `NODE_ENV=production` (no `VERCEL_ENV`) lands in the production namespace, which is what it needs to
 * consume the queues that Vercel Production produces. **A host that sets neither `NODE_ENV=production` nor `AFFISELL_REDIS_NAMESPACE`
 * does NOT**: it resolves to `dev:` and listens on `dev:bull` while Vercel enqueues on `bull`, silently. Nothing here can know a host is
 * meant to be production, so every worker reports its namespace at start (`diagnoseRedisNamespace`, `lib/worker-redis-namespace.ts`:
 * an INFO line always, an ERROR line plus an ops alert when the namespace is not production and was not set explicitly).
 * A worker that must serve Preview's queues sets `AFFISELL_REDIS_NAMESPACE=preview` (docs/ENVIRONMENTS.md).
 *
 * `AFFISELL_REDIS_NAMESPACE` is the explicit override: on a Vercel Preview / Development deployment the value "production" is ignored
 * (it would re-create the shared namespace this module exists to prevent); OFF Vercel it is honoured (a worker host that does not set
 * NODE_ENV=production would otherwise listen on `dev:bull` while Vercel Production enqueues on `bull`). Any other value must be 1–24
 * characters of `a-z 0-9 -`, otherwise it is ignored and the environment decides.
 *
 * Pure: no `server-only`, no Redis client, no I/O. Redis pattern arguments (`KEYS affisell:shield:ban:*`) are prefixed the same way,
 * which is why the namespace alphabet contains no glob character.
 */
import { readVercelEnvironment, resolveRuntimeEnvironment, type RuntimeEnvironment } from "@/lib/runtime-environment"

type EnvBag = Record<string, string | undefined>

export const REDIS_NAMESPACE_VARIABLE = "AFFISELL_REDIS_NAMESPACE"

const NAMESPACE_RE = /^[a-z0-9][a-z0-9-]{0,23}$/
const PRODUCTION_ALIASES = new Set(["production", "prod"])

/** BullMQ's own default prefix. Production keeps it, so existing queues (`bull:<queue>:…`) stay where they are. */
export const BULLMQ_DEFAULT_PREFIX = "bull"

function resolveNamespace(env: EnvBag): { namespace: string; explicit: boolean; environment: RuntimeEnvironment } {
  const environment = resolveRuntimeEnvironment(env)
  const derived = environment === "production" ? "" : environment === "preview" ? "preview" : environment === "development" ? "dev" : "test"

  const raw = env[REDIS_NAMESPACE_VARIABLE]?.trim().toLowerCase()
  if (!raw) return { namespace: derived, explicit: false, environment }
  if (PRODUCTION_ALIASES.has(raw)) {
    // A Vercel Preview / Development deployment is NEVER pulled into the production namespace. Off Vercel the value is a deliberate
    // decision of whoever starts the process (a worker host that does not set NODE_ENV=production must be able to join production's queues).
    const vercel = readVercelEnvironment(env)
    return vercel === "preview" || vercel === "development"
      ? { namespace: derived, explicit: false, environment }
      : { namespace: "", explicit: true, environment }
  }
  // an invalid value is ignored (the environment decides) and therefore does NOT count as an explicit choice
  return NAMESPACE_RE.test(raw) ? { namespace: raw, explicit: true, environment } : { namespace: derived, explicit: false, environment }
}

/** The namespace WITHOUT its trailing colon: "" (production), "preview", "dev", "test", or a validated explicit value. */
export function redisNamespace(env: EnvBag = process.env): string {
  return resolveNamespace(env).namespace
}

export type RedisNamespaceDiagnosis = {
  environment: RuntimeEnvironment
  /** The namespace actually used, without its colon; "" = production. */
  namespace: string
  /** Human-readable: "production" for the empty namespace, otherwise the namespace itself. */
  label: string
  /** The BullMQ `prefix` actually used (`bull` in production). */
  bullmqPrefix: string
  /** True when AFFISELL_REDIS_NAMESPACE was set to a VALID value that was honoured. */
  explicit: boolean
  /**
   * A non-production namespace that nobody asked for: derived from the environment alone. On a host that is supposed to consume
   * production's queues this is the silent-starvation state (`dev:bull` while Vercel enqueues on `bull`).
   */
  notExplicitlyChosen: boolean
}

/** What this process will actually use, and whether that is a choice or a default. Pure; no secret in the result. */
export function diagnoseRedisNamespace(env: EnvBag = process.env): RedisNamespaceDiagnosis {
  const { namespace, explicit, environment } = resolveNamespace(env)
  return {
    environment,
    namespace,
    label: namespace || "production",
    bullmqPrefix: namespace ? `${namespace}:${BULLMQ_DEFAULT_PREFIX}` : BULLMQ_DEFAULT_PREFIX,
    explicit,
    notExplicitlyChosen: namespace !== "" && !explicit,
  }
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
