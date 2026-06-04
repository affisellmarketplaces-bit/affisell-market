import { Logger } from "@logtail/next"

/**
 * Better Stack / Logtail — server routes.
 * Requires LOGTAIL_SOURCE_TOKEN + LOGTAIL_URL (ingest host) on Vercel.
 * @see docs/monitoring-logtail.md
 */
function ensureLogtailEnv(): void {
  const token =
    process.env.LOGTAIL_SOURCE_TOKEN?.trim() ||
    process.env.BETTER_STACK_SOURCE_TOKEN?.trim()
  if (!token) return
  if (
    !process.env.LOGTAIL_URL?.trim() &&
    !process.env.BETTER_STACK_INGESTING_URL?.trim() &&
    !process.env.LOGTAIL_INGESTING_URL?.trim()
  ) {
    process.env.LOGTAIL_URL = "https://in.logs.betterstack.com"
  }
}

ensureLogtailEnv()

/** Singleton — `autoFlush: false` : appeler `flushLogs()` avant chaque return (Vercel serverless). */
export const logger = new Logger({
  autoFlush: false,
  source: "affisell-server",
})

export function isLogtailConfigured(): boolean {
  const token =
    process.env.LOGTAIL_SOURCE_TOKEN?.trim() ||
    process.env.BETTER_STACK_SOURCE_TOKEN?.trim()
  const url =
    process.env.LOGTAIL_URL?.trim() ||
    process.env.BETTER_STACK_INGESTING_URL?.trim() ||
    process.env.LOGTAIL_INGESTING_URL?.trim()
  return Boolean(token && url)
}

export async function flushLogs(): Promise<void> {
  await logger.flush()
}

export function clientIpFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  )
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function errorStackSnippet(e: unknown, max = 500): string | undefined {
  if (!(e instanceof Error) || !e.stack) return undefined
  return e.stack.slice(0, max)
}
