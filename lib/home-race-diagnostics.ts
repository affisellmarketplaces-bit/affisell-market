import { logBusiness } from "@/lib/business-log"

/**
 * DIAGNOSTIC ONLY — passive observation of the `Promise.race(work, timeout)` calls on the home page.
 *
 * Question it answers: when the timeout wins and the caller already has its fallback, does the losing Prisma work
 * keep running (and for how long), or is it already finished? `Promise.race` never cancels the loser.
 *
 * Contract (the whole point of this file):
 *  - `watch(work)` returns THE SAME promise object, unchanged. It only attaches a settle observer. It never awaits,
 *    clones, retries, cancels, delays or detaches the work, and it never alters its value or its rejection.
 *  - `onTimeout()` is called by the existing timer callback AFTER the original `resolve` / `reject`; it only logs.
 *  - Every diagnostic operation is wrapped so a logging failure can never reach the application path.
 *  - No Prisma, no DB, no Next dynamic API (`headers()`, `cookies()`…), no env access, no new React API.
 *  - Logged data: ids, timings and counters only. Errors are reduced to `error.name` and a Prisma code (`P2024`…):
 *    never `error.message` (it can embed query text).
 *
 * Search production logs for `[home_race]`, and for `PROMISE_SETTLED_AFTER_TIMEOUT` / `TIMEOUT`.
 * A TIMEOUT whose `race_id` never gets a later PROMISE_SETTLED_AFTER_TIMEOUT / ERROR_AFTER_TIMEOUT means the work had
 * not settled by the time the instance stopped being observed (frozen or recycled mid-flight).
 */

export const HOME_RACE_LOG_MODULE = "home_race"

type Fields = Record<string, string | number | boolean | undefined>

/** One id per process (serverless instance), to tell instances apart and to group the races of one instance. */
const INSTANCE_ID = Math.random().toString(36).slice(2, 8)

let raceSequence = 0
/** Watched promises not settled yet in THIS process — abandoned losers included. Per-instance memory only. */
let inflight = 0

function processUptimeSeconds(): number | undefined {
  try {
    return typeof process !== "undefined" && typeof process.uptime === "function" ? Math.round(process.uptime()) : undefined
  } catch {
    return undefined
  }
}

function emit(event: string, fields: Fields): void {
  try {
    logBusiness(HOME_RACE_LOG_MODULE, {
      event,
      ts: new Date().toISOString(),
      ...fields,
      uptime_s: processUptimeSeconds(),
    })
  } catch {
    /* a diagnostic failure must never affect the request */
  }
}

/** `error.name` + Prisma code only. Never the message, never the stack. */
function describeError(error: unknown): Fields {
  try {
    const name = error instanceof Error ? error.name : typeof error
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined
    return {
      error_name: String(name).slice(0, 60),
      error_code: typeof code === "string" && /^P\d{4}$/.test(code) ? code : undefined,
    }
  } catch {
    return { error_name: "unknown" }
  }
}

/** Optional extra fields (e.g. which parts of the shell had finished). Evaluated lazily inside the safe wrapper. */
function safeExtra(extra: (() => Fields) | undefined): Fields {
  if (!extra) return {}
  try {
    const out: Fields = {}
    for (const [key, value] of Object.entries(extra())) {
      out[key] = typeof value === "string" ? value.slice(0, 120) : value
    }
    return out
  } catch {
    return {}
  }
}

export type HomeRaceProbe = {
  readonly raceId: string
  /** Observes `work` and returns that very same promise. */
  watch<T>(work: Promise<T>): Promise<T>
  /** Call from the timer callback, after the original resolve/reject. Logs only if the work is still pending. */
  onTimeout(extra?: () => Fields): void
}

/**
 * Creates the probe for one race. It allocates a little state and starts no work, so calling it before the race is
 * evaluation-order neutral.
 */
export function startHomeRace(loader: string, timeoutMs: number): HomeRaceProbe {
  const raceId = `${INSTANCE_ID}-${++raceSequence}`
  const base = (): Fields => ({ loader, race_id: raceId, instance: INSTANCE_ID, timeout_ms: timeoutMs })

  let watching = false
  let settled = false
  let timedOut = false
  let startedAt = 0
  let timeoutAt = 0

  const settle = (failed: boolean, error?: unknown): void => {
    try {
      if (settled) return
      settled = true
      inflight = Math.max(0, inflight - 1)
      const now = Date.now()
      const failure = failed ? describeError(error) : {}
      if (!timedOut) {
        emit(failed ? "ERROR" : "RACE_WON", {
          ...base(),
          outcome: failed ? "ERROR_BEFORE_TIMEOUT" : "SETTLED_BEFORE_TIMEOUT",
          elapsed_ms: now - startedAt,
          inflight_after: inflight,
          ...failure,
        })
        return
      }
      emit(failed ? "ERROR_AFTER_TIMEOUT" : "PROMISE_SETTLED_AFTER_TIMEOUT", {
        ...base(),
        outcome: failed ? "ERROR_AFTER_TIMEOUT" : "SETTLED_AFTER_TIMEOUT",
        elapsed_ms: now - startedAt,
        after_timeout_ms: now - timeoutAt,
        inflight_after: inflight,
        ...failure,
      })
    } catch {
      /* diagnostics only */
    }
  }

  return {
    raceId,
    watch<T>(work: Promise<T>): Promise<T> {
      try {
        if (watching) return work // only the first promise handed to this probe is observed
        watching = true
        startedAt = Date.now()
        const inflightBefore = inflight
        inflight += 1
        emit("START", { ...base(), inflight_before: inflightBefore })
        // Two-argument `then`: handles BOTH outcomes on the derived promise, which is discarded. `work` itself, and
        // whatever `Promise.race` does with it, are not touched. The handlers never throw.
        void work.then(
          () => settle(false),
          (error: unknown) => settle(true, error)
        )
      } catch {
        /* diagnostics only */
      }
      return work
    },
    onTimeout(extra?: () => Fields): void {
      try {
        // Not watching, already settled (the timer is not cleared in several races and fires later anyway), or fired twice.
        if (!watching || settled || timedOut) return
        timedOut = true
        timeoutAt = Date.now()
        emit("TIMEOUT", {
          ...base(),
          outcome: "TIMEOUT",
          elapsed_ms: timeoutAt - startedAt,
          still_running: true,
          inflight,
          ...safeExtra(extra),
        })
      } catch {
        /* diagnostics only */
      }
    },
  }
}

/** @internal tests only */
export function __resetHomeRaceDiagnosticsForTests(): void {
  raceSequence = 0
  inflight = 0
}
