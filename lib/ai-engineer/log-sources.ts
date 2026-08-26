import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const LOG_PATTERNS = [
  "Engine was empty",
  "manual_required",
  "auto_buy_async_failed",
  "email_failed",
  "order_confirmation_email_failed",
  "[fulfillment]",
  "[prisma]",
  "[fulfillment-orchestrator]",
] as const

/** Collect recent dev log lines from ring file + optional Cursor terminal dumps. */
export function collectDevLogLines(limit = 100): string[] {
  const lines: string[] = []

  const ringPath = process.env.ING_LOG_RING?.trim() || join(process.cwd(), ".affisell", "ing-dev.log")
  if (existsSync(ringPath)) {
    try {
      const raw = readFileSync(ringPath, "utf8")
      lines.push(...raw.split("\n").filter(Boolean))
    } catch (error) {
      console.warn("[ing]", {
        stage: "log_ring_read",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const terminalDir = process.env.ING_TERMINAL_DIR?.trim()
  if (terminalDir && existsSync(terminalDir)) {
    try {
      const files = readdirSync(terminalDir)
        .filter((f) => f.endsWith(".txt"))
        .slice(-3)
      for (const f of files) {
        const content = readFileSync(join(terminalDir, f), "utf8")
        const contentLines = content.split("\n").filter((l) => LOG_PATTERNS.some((p) => l.includes(p)))
        lines.push(...contentLines)
      }
    } catch {
      /* optional dev path */
    }
  }

  return lines.slice(-limit)
}

/** Append a log line to the dev ring (idempotent mkdir in caller). */
export function filterRelevantLogLines(lines: string[]): string[] {
  return lines.filter((line) => LOG_PATTERNS.some((p) => line.includes(p)))
}
