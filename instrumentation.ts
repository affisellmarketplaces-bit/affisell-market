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
