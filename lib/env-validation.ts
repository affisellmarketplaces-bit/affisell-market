/**
 * Central environment validation (finalisation master J3).
 *
 * Until now nothing checked, in one place, that the variables a deployment cannot work without are set. `lib/env.ts` is a URL
 * resolver; `instrumentation.ts` only warned about `DATABASE_URL`; a missing `AUTH_SECRET` made the proxy's guards silently disappear
 * and a missing `STRIPE_WEBHOOK_SECRET` made every payment webhook answer 503 with nobody told. This module is the single list of what
 * each environment needs, and the single place that turns "something is wrong with the environment" into ONE structured log line.
 *
 * HARD RULES
 *  - Names only. A message, a log line or a report NEVER contains a value (not even a prefix): findings carry variable NAMES and static
 *    text. Length checks and "is it equal to that other secret" checks are done in memory and only their boolean outcome is reported.
 *  - Pure and side-effect free at import time: no `server-only`, no I/O, no database, no `.env*` read. `validateEnvironment` takes the
 *    environment as an argument (default `process.env`) so it can be tested and run anywhere.
 *  - It never throws and never stops the server: a deployment with a critical finding keeps serving what it can; the finding is logged
 *    at error level (Vercel logs, Sentry) so someone is told. `runStartupEnvValidation` does nothing during `next build`.
 */
import { extractHostFromDatabaseUrl, resolveNeonBranchFromHost } from "@/lib/db-env"
import { classifyStripeKey } from "@/lib/stripe-key-guard"
import { readVercelEnvironment, resolveRuntimeEnvironment, type RuntimeEnvironment } from "@/lib/runtime-environment"

type EnvBag = Record<string, string | undefined>

export type EnvFindingSeverity = "critical" | "warning"

export type EnvFinding = {
  /** Stable identifier (tests, log filters, alert rules). */
  id: string
  severity: EnvFindingSeverity
  /** Variable NAMES involved — never values. */
  variables: string[]
  /** Static English text. */
  message: string
}

export type EnvRequirement = {
  id: string
  /** The requirement is met when AT LEAST ONE of these is set (non-empty after trim). */
  anyOf: readonly string[]
  severity: EnvFindingSeverity
  /** Environments in which it applies. */
  environments: readonly RuntimeEnvironment[]
  /** What breaks without it. Static text. */
  message: string
}

const PRODUCTION: readonly RuntimeEnvironment[] = ["production"]
const DEPLOYED: readonly RuntimeEnvironment[] = ["production", "preview"]

/**
 * What each environment needs. `critical` = a core flow is broken or unprotected without it; `warning` = a feature or a safety net is
 * missing. Production is the strict one; a Preview needs the same core (its own, non-production values); development and tests need
 * nothing (a laptop is allowed to run partially).
 */
export const ENV_REQUIREMENTS: readonly EnvRequirement[] = [
  {
    id: "auth_secret_missing",
    anyOf: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
    severity: "critical",
    environments: DEPLOYED,
    message:
      "No session secret: Auth.js cannot sign or read sessions, and the proxy treats every visitor as anonymous (protected pages redirect to the login).",
  },
  {
    id: "database_url_missing",
    anyOf: ["DATABASE_URL"],
    severity: "critical",
    environments: DEPLOYED,
    message: "No database URL: every page and API route that reads or writes data fails.",
  },
  {
    id: "cron_secret_missing",
    anyOf: ["CRON_SECRET"],
    severity: "critical",
    environments: PRODUCTION,
    message: "No cron secret: every /api/cron/* route refuses its caller, so payouts, reconciliation and syncs never run.",
  },
  {
    id: "stripe_secret_key_missing",
    anyOf: ["STRIPE_SECRET_KEY"],
    severity: "critical",
    environments: PRODUCTION,
    message: "No Stripe secret key: checkout, refunds and transfers cannot work.",
  },
  {
    id: "stripe_webhook_secret_missing",
    anyOf: ["STRIPE_WEBHOOK_SECRET"],
    severity: "critical",
    environments: PRODUCTION,
    message: "No Stripe webhook signing secret: /api/webhooks/stripe answers 503, so paid orders are never recorded.",
  },
  {
    id: "encryption_key_missing",
    anyOf: ["ENCRYPTION_KEY", "TIKTOK_TOKEN_ENCRYPTION_KEY"],
    severity: "critical",
    environments: PRODUCTION,
    message: "No encryption key: stored marketplace / supplier tokens (AliExpress, TikTok, integrations) cannot be read or written.",
  },
  {
    id: "app_url_missing",
    anyOf: ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "AUTH_URL"],
    severity: "warning",
    environments: DEPLOYED,
    message: "No public application URL: links in e-mails, redirects and OAuth callbacks fall back to guesses.",
  },
  {
    id: "redis_rest_missing",
    anyOf: ["UPSTASH_REDIS_REST_URL"],
    severity: "warning",
    environments: PRODUCTION,
    message: "No Upstash REST Redis: IP bans, shield logs and AI caches fall back to per-instance memory (not shared between serverless instances).",
  },
  {
    id: "redis_queue_missing",
    anyOf: ["REDIS_URL"],
    severity: "warning",
    environments: PRODUCTION,
    message: "No REDIS_URL: BullMQ queues and distributed rate limits are off (in-memory limiter per instance, Inngest fallback for fulfilment).",
  },
  {
    id: "direct_database_url_missing",
    anyOf: ["DATABASE_URL_UNPOOLED", "DIRECT_URL"],
    severity: "warning",
    environments: PRODUCTION,
    message: "No direct (unpooled) database URL: fulfilment writes go through the pooler.",
  },
  {
    id: "sentry_dsn_missing",
    anyOf: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
    severity: "warning",
    environments: PRODUCTION,
    message: "No Sentry DSN: server and browser errors are not reported anywhere.",
  },
  {
    id: "media_storage_missing",
    anyOf: ["R2_ACCESS_KEY_ID", "BLOB_READ_WRITE_TOKEN"],
    severity: "warning",
    environments: PRODUCTION,
    message: "No media storage credentials (R2 or Vercel Blob): supplier photo and video uploads fail.",
  },
  {
    id: "email_key_missing",
    anyOf: ["RESEND_API_KEY"],
    severity: "warning",
    environments: PRODUCTION,
    message: "No Resend API key: transactional e-mails (order confirmations, alerts) are not sent.",
  },
]

/** Variables that hold a database URL and must never name production on a Preview. Names only. */
const DATABASE_URL_VARIABLES = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
  "DATABASE_URL_STAGING",
  "RADAR_DATABASE_URL",
  "MARKET_INTELLI_DATABASE_URL",
] as const

/** Secrets that must each be distinct from CRON_SECRET (finalisation master O-3: a cron secret that doubles as an OAuth / signing secret). */
const SECRETS_DISTINCT_FROM_CRON = [
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "SHOPIFY_API_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "ENCRYPTION_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const

function value(env: EnvBag, name: string): string {
  return env[name]?.trim() ?? ""
}

function firstSet(env: EnvBag, names: readonly string[]): string | null {
  return names.find((name) => value(env, name) !== "") ?? null
}

function isTruthyFlag(raw: string): boolean {
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase())
}

function branchOf(url: string): "production" | "staging" | "local" | "other" {
  const host = extractHostFromDatabaseUrl(url).replace(/:\d+$/, "")
  const branch = resolveNeonBranchFromHost(host)
  if (branch === "production") return "production"
  if (branch === "staging") return "staging"
  if (branch === "local") return "local"
  return "other"
}

export type EnvReport = {
  environment: RuntimeEnvironment
  /** False as soon as one finding is `critical`. */
  ok: boolean
  findings: EnvFinding[]
}

/** Validates `env` for the environment it describes. Pure; never throws; never returns a value, only names and static text. */
export function validateEnvironment(env: EnvBag = process.env): EnvReport {
  const environment = resolveRuntimeEnvironment(env)
  const findings: EnvFinding[] = []

  for (const requirement of ENV_REQUIREMENTS) {
    if (!requirement.environments.includes(environment)) continue
    if (firstSet(env, requirement.anyOf) !== null) continue
    findings.push({
      id: requirement.id,
      severity: requirement.severity,
      variables: [...requirement.anyOf],
      message: requirement.message,
    })
  }

  // --- shape checks: only when the variable is set (a missing one is reported above) -------------------------------------------------

  const databaseUrl = value(env, "DATABASE_URL")
  if (databaseUrl && !/^postgres(?:ql)?:/i.test(databaseUrl)) {
    findings.push({
      id: "database_url_not_postgres",
      severity: "critical",
      variables: ["DATABASE_URL"],
      message: "DATABASE_URL is set but is not a postgres:// or postgresql:// URL.",
    })
  }

  const encryptionVariable = firstSet(env, ["ENCRYPTION_KEY", "TIKTOK_TOKEN_ENCRYPTION_KEY"])
  if (encryptionVariable && value(env, encryptionVariable).length < 32 && DEPLOYED.includes(environment)) {
    findings.push({
      id: "encryption_key_too_short",
      severity: "critical",
      variables: [encryptionVariable],
      message: "The encryption key is shorter than 32 characters: it is refused at use, so stored tokens cannot be read or written.",
    })
  }

  const payoutKey = value(env, "PAYOUT_ENCRYPTION_KEY")
  if (payoutKey && !/^[0-9a-f]{64}$/i.test(payoutKey)) {
    findings.push({
      id: "payout_encryption_key_invalid",
      severity: "warning",
      variables: ["PAYOUT_ENCRYPTION_KEY"],
      message: "PAYOUT_ENCRYPTION_KEY must be 32 bytes as 64 hexadecimal characters (openssl rand -hex 32).",
    })
  }

  if (environment === "production") {
    for (const name of ["AUTH_SECRET", "NEXTAUTH_SECRET", "CRON_SECRET"] as const) {
      const secret = value(env, name)
      if (secret && secret.length < 16) {
        findings.push({
          id: "secret_too_short",
          severity: "warning",
          variables: [name],
          message: "This secret is shorter than 16 characters; use at least 32 random characters (openssl rand -base64 32).",
        })
      }
    }
  }

  // --- isolation checks (finalisation master K1) --------------------------------------------------------------------------------------

  if (environment === "preview") {
    for (const name of DATABASE_URL_VARIABLES) {
      const url = value(env, name)
      if (url && branchOf(url) === "production") {
        findings.push({
          id: "preview_points_at_production_database",
          severity: "critical",
          variables: [name],
          message:
            "This Preview deployment's database variable names the PRODUCTION database. The database clients refuse to start; point it at the staging branch or remove it.",
        })
      }
    }
  }

  if (environment === "production") {
    for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL"] as const) {
      const url = value(env, name)
      const branch = url ? branchOf(url) : "other"
      if (url && (branch === "staging" || branch === "local")) {
        findings.push({
          id: "production_points_at_non_production_database",
          severity: "critical",
          variables: [name],
          message: `This Production deployment's database variable names a ${branch} database, not the production one.`,
        })
      }
    }
  }

  const stripeMode = classifyStripeKey(env.STRIPE_SECRET_KEY)
  if (stripeMode === "live" && environment !== "production") {
    findings.push({
      id: "stripe_live_key_outside_production",
      severity: "critical",
      variables: ["STRIPE_SECRET_KEY"],
      message: "A LIVE Stripe key is configured outside production. The Stripe client refuses it; use the Stripe TEST key in this environment.",
    })
  }
  if (stripeMode === "test" && environment === "production") {
    findings.push({
      id: "stripe_test_key_in_production",
      severity: "warning",
      variables: ["STRIPE_SECRET_KEY"],
      message: "Production runs on a Stripe TEST key: no real payment can succeed. Expected only before launch.",
    })
  }
  if (value(env, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").startsWith("pk_live_") && environment !== "production") {
    findings.push({
      id: "stripe_live_publishable_key_outside_production",
      severity: "warning",
      variables: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
      message: "A LIVE Stripe publishable key is configured outside production; use the test publishable key here.",
    })
  }

  const namespace = value(env, "AFFISELL_REDIS_NAMESPACE").toLowerCase()
  const vercelEnvironment = readVercelEnvironment(env)
  if ((namespace === "production" || namespace === "prod") && (vercelEnvironment === "preview" || vercelEnvironment === "development")) {
    findings.push({
      id: "redis_namespace_production_outside_production",
      severity: "warning",
      variables: ["AFFISELL_REDIS_NAMESPACE"],
      message:
        "AFFISELL_REDIS_NAMESPACE names production on a Vercel Preview / Development deployment; it is ignored (the environment's own namespace is used).",
    })
  }

  // --- secrets hygiene ----------------------------------------------------------------------------------------------------------------

  const cronSecret = value(env, "CRON_SECRET")
  if (cronSecret && DEPLOYED.includes(environment)) {
    const shared = SECRETS_DISTINCT_FROM_CRON.filter((name) => value(env, name) === cronSecret)
    if (shared.length > 0) {
      findings.push({
        id: "cron_secret_reused",
        severity: "warning",
        variables: ["CRON_SECRET", ...shared],
        message: "CRON_SECRET has the same value as another secret; give each its own random value.",
      })
    }
  }

  // --- money-spending switches that must be a conscious decision ----------------------------------------------------------------------

  if (isTruthyFlag(value(env, "AUTO_BUY_ENABLED")) && environment !== "test") {
    findings.push({
      id: "auto_buy_enabled",
      severity: "warning",
      variables: ["AUTO_BUY_ENABLED"],
      message:
        "Auto-buy is ENABLED: it spends the company's money on supplier orders. It needs the owner's explicit business and financial validation.",
    })
  }

  return { environment, ok: findings.every((f) => f.severity !== "critical"), findings }
}

/** The structured, value-free object logged for a report. */
export function envReportLogFields(report: EnvReport): {
  result: "ok" | "warnings" | "critical"
  environment: RuntimeEnvironment
  critical: string[]
  warnings: string[]
  variables: string[]
} {
  const critical = report.findings.filter((f) => f.severity === "critical")
  const warnings = report.findings.filter((f) => f.severity === "warning")
  const variables = [...new Set(report.findings.flatMap((f) => f.variables))].sort()
  return {
    result: critical.length > 0 ? "critical" : warnings.length > 0 ? "warnings" : "ok",
    environment: report.environment,
    critical: critical.map((f) => f.id),
    warnings: warnings.map((f) => f.id),
    variables,
  }
}

let startupValidationDone = false

/** Test seam. */
export function resetStartupEnvValidationForTests(): void {
  startupValidationDone = false
}

/**
 * Validates the environment once per server process and logs the outcome (names only): error level when something is critical, warn
 * level for warnings, one info line when clean. Called from `instrumentation.ts`. Does NOTHING during `next build` (the build's
 * environment is not the runtime's, and the build must stay free of side effects) and never throws.
 */
export function runStartupEnvValidation(env: EnvBag = process.env): EnvReport | null {
  try {
    if (env.NEXT_PHASE === "phase-production-build") return null
    if (startupValidationDone) return null
    startupValidationDone = true
    const report = validateEnvironment(env)
    const fields = envReportLogFields(report)
    if (fields.result === "critical") {
      console.error("[env-validation]", { ...fields, details: report.findings.map((f) => ({ id: f.id, variables: f.variables, message: f.message })) })
    } else if (fields.result === "warnings") {
      console.warn("[env-validation]", { ...fields, details: report.findings.map((f) => ({ id: f.id, variables: f.variables })) })
    } else {
      console.info("[env-validation]", fields)
    }
    return report
  } catch {
    console.error("[env-validation]", { result: "validator_failed" })
    return null
  }
}
