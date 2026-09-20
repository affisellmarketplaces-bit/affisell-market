import "server-only"

import { after } from "next/server"

/**
 * Run non-critical work (e-mails, supplier auto-order triggers, syncs) AFTER the response has been sent, so the
 * buyer / Stripe never wait for it. Uses Next's `after()` (kept alive by the platform, unlike a floating promise).
 *
 * Outside a request scope (cron, scripts) `after()` is unavailable: the task then runs inline and is awaited, so
 * behaviour there is unchanged. Errors are always contained and logged — a failing side effect never fails the caller.
 */
export async function runAfterResponse(label: string, task: () => Promise<unknown>): Promise<void> {
  const guarded = async () => {
    try {
      await task()
    } catch (error) {
      console.error("[after-response]", { label, error: error instanceof Error ? error.message : String(error) })
    }
  }
  try {
    after(guarded)
  } catch {
    await guarded()
  }
}
