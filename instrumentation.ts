import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
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
