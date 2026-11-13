/**
 * Which Vercel environment is this code running in? ONE definition, pure (no `server-only`, no Prisma, no Node API), so that the
 * browser bundle (Sentry client), the Edge runtime (Sentry edge, proxy) and the Node server can all use it.
 *
 * Finalisation master K1 — isolation Preview / Production. Until now `NODE_ENV` was used for that, and `NODE_ENV` is `production` on
 * EVERY deployed build, Preview included: a Preview error was filed under "production" in Sentry, and a Preview shared the Redis
 * keys of production. `VERCEL_ENV` is the variable that tells the two apart.
 *
 * Reading order: `VERCEL_ENV` (server / edge, always set by Vercel at runtime) → `NEXT_PUBLIC_VERCEL_ENV` (the same value, inlined
 * into the browser bundle by `next.config.ts`) → `NODE_ENV`.
 */

export type RuntimeEnvironment = "production" | "preview" | "development" | "test"

type EnvBag = Record<string, string | undefined>

/** The environment name Vercel reports, normalised; null when Vercel did not say (or said something unknown). */
export function readVercelEnvironment(env: EnvBag = process.env): "production" | "preview" | "development" | null {
  const raw = (env.VERCEL_ENV ?? env.NEXT_PUBLIC_VERCEL_ENV)?.trim().toLowerCase()
  if (raw === "production" || raw === "preview" || raw === "development") return raw
  return null
}

/**
 * The runtime environment. Without a Vercel signal it falls back to `NODE_ENV`:
 * `production` off-Vercel is the self-hosted production worker (Railway), which has to share production's Redis namespace —
 * see `lib/redis-namespace.ts`. Callers that must NOT assume "production" without proof (Sentry) use `readVercelEnvironment`.
 */
export function resolveRuntimeEnvironment(env: EnvBag = process.env): RuntimeEnvironment {
  const vercel = readVercelEnvironment(env)
  if (vercel) return vercel
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase()
  if (nodeEnv === "production") return "production"
  if (nodeEnv === "test") return "test"
  return "development"
}

/**
 * The label Sentry files events under. `production` is claimed ONLY when Vercel says so: a local `next start`, a CI build or a
 * browser bundle built without the Vercel signal must not land in the production environment (that is what `NODE_ENV` did).
 * "unknown" (a deployed-looking build with no Vercel signal) is a visible, alertable value; it never pollutes `production`.
 */
export function resolveSentryEnvironment(env: EnvBag = process.env): string {
  const vercel = readVercelEnvironment(env)
  if (vercel) return vercel
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase()
  if (nodeEnv === "test") return "test"
  if (nodeEnv === "production") return "unknown"
  return "development"
}
