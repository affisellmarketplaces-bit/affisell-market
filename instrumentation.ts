import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
    // Diagnostics only (lib/runtime-liveness.ts): one unref'd 1 s timer, no Prisma, no network, once per process. Started BEFORE the
    // warm connect so that cold-start operations are covered. A failure here must never stop the server from booting.
    try {
      const { startRuntimeLiveness } = await import("@/lib/runtime-liveness")
      startRuntimeLiveness()
    } catch {
      console.warn("[instrumentation] runtime liveness diagnostics not started")
    }
    // Central environment validation (finalisation master J3): ONE structured `[env-validation]` log line, variable NAMES only, once per
    // process. Does nothing during `next build`, never throws, never stops the server. A critical finding in a deployed environment is
    // also reported to Sentry (names only), so a missing AUTH_SECRET / STRIPE_WEBHOOK_SECRET is not discovered by a customer.
    try {
      const { runStartupEnvValidation, envReportLogFields } = await import("@/lib/env-validation")
      const report = runStartupEnvValidation()
      if (report && !report.ok && (report.environment === "production" || report.environment === "preview")) {
        const fields = envReportLogFields(report)
        Sentry.captureMessage("[env-validation] critical environment findings", {
          level: "error",
          tags: { feature: "env-validation", runtime_environment: report.environment },
          extra: { critical: fields.critical, variables: fields.variables },
        })
      }
    } catch {
      console.warn("[instrumentation] environment validation not run")
    }
    if (process.env.DATABASE_URL?.trim()) {
      const { connectPrismaWithRetry } = await import("@/lib/prisma")
      await connectPrismaWithRetry()
    } else {
      console.warn("[instrumentation] DATABASE_URL missing — skip prisma warm connect")
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
