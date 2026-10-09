import "server-only"

import { logBusiness } from "@/lib/business-log"
import { isPrismaCircuitOpen } from "@/lib/prisma-circuit-breaker"
import {
  isNeonEngineNotReadyError,
  isRetryablePrismaConnectionError,
  prismaErrorCode,
} from "@/lib/prisma-connection-error"
import { RUNTIME_INSTANCE_ID } from "@/lib/runtime-instance"

/**
 * PASSIVE diagnostics for Prisma operations (`[prisma_diag]`). Question it helps answer: when a database session stays
 * `idle in transaction` for ~300 s and a P1017 follows, was the process paused with operations in flight, was its event loop
 * saturated, or was an operation waiting on something upstream while the process ran normally?
 *
 * Contract (the whole point of this file):
 *  - It OBSERVES `executeWithReconnect` (see lib/prisma.ts) and changes nothing: same arguments, same attempts, same delays, same
 *    result, same rejection object. Every function here is wrapped so that a diagnostic failure is swallowed, counted
 *    (`selfErrors`) and never reaches the query path.
 *  - The registry of in-flight operations stores PRIMITIVES ONLY (numbers and a sanitised `Model.operation` name): never an
 *    argument, a result, a promise, an error message or SQL. It is bounded (`MAX_INFLIGHT_OPS`): when full, collection degrades
 *    (`dropped` counter), the query does not. An entry is removed in `endPrismaOp` unconditionally (success, rejection, non-Error
 *    rejection) and anything older than `INFLIGHT_EXPIRE_MS` is swept.
 *  - Logged: instance id, operation name (`Model.operation`, each part checked against an identifier pattern), durations, attempt
 *    count, an error CLASS and an error NAME from closed lists, a Prisma code matching /^P\d{4}$/, circuit state, client generation, overlap with
 *    event-loop gaps ALREADY reported and the age of the last heartbeat tick (see below). Never: SQL, parameters, business data, URLs,
 *    secrets, `error.message`.
 *  - Volume: only connection-class failures, operations slower than `SLOW_OP_MS`, event-loop gaps and client creations are logged,
 *    at most `MAX_LOGS_PER_MINUTE` lines per event type per minute (the excess is counted in `suppressed`).
 *  - No timer, no `await`, no `after()` / `waitUntil()`: nothing here can extend a response or hold a promise.
 *
 * Reading an operation line (`OP_ERROR` / `OP_SLOW`) against event-loop gaps. Two independent measures; NEITHER alone proves that the
 * operation did or did not cross a gap:
 *  - `gap_overlap_reported_ms`: overlap between the operation's life and the gaps the heartbeat had ALREADY logged as `RUNTIME_GAP`
 *    when the operation finished. A gap is recorded by the first heartbeat tick that runs AFTER it, and after a pause the event loop can
 *    process an operation's completion BEFORE that late tick. So `0` means "no reported gap overlapped", never "no gap was crossed".
 *  - `tick_age_ms`: time between the last heartbeat tick and the instant the operation finished, on the monotonic clock. About one
 *    heartbeat interval (≈1 s) or less while the loop was turning; as long as the silence when no timer had run — whether or not the
 *    late tick has reported it yet. It does not say how much of THIS operation's life fell in that silence (compare with `duration_ms`).
 *    "Tick" = the timer fired, whether or not its clock probes could be read (see runtime-liveness.ts: such a tick is "unmeasured").
 *    Omitted when no heartbeat has ticked in this process (heartbeat not started or stopped), and when the diagnostic clock could not
 *    be read at the last tick (stamp cleared): nothing is then claimed.
 * Clock reservation. `duration_ms` and `tick_age_ms` are measured on the MONOTONIC clock (`performance.now()`). If that clock does not
 * count all the time a process is suspended, both can UNDERSTATE the time that really elapsed: an operation that spanned a suspension
 * could then show a short duration and a small tick age. How the monotonic clock behaves during a suspension has NOT been established
 * for the production environment (Vercel included), and the same holds for the wall clock behind `gap_overlap_reported_ms`.
 * Order after a pause: the completion line can come first (`gap_overlap_reported_ms: 0`, large `tick_age_ms`) and the `RUNTIME_GAP`
 * line right after it, from the late tick. Pair them through the instance id and the timestamps, not through the zero.
 *
 * State lives on `globalThis` (like the Prisma singleton) so duplicated module instances in one process share one registry.
 * Active in production only, unless `AFFISELL_RUNTIME_DIAG=0` (changing it on Vercel needs a new deployment).
 */

export const PRISMA_DIAG_LOG_MODULE = "prisma_diag"
export const MAX_INFLIGHT_OPS = 256
export const INFLIGHT_EXPIRE_MS = 15 * 60_000
export const SLOW_OP_MS = 5_000
export const MAX_GAP_HISTORY = 8
export const MAX_LOGS_PER_MINUTE = 20

type Fields = Record<string, string | number | boolean | undefined>
type Entry = { wall: number; mono: number; key: string; attempts: number; generation: number }
type Gap = { startWall: number; endWall: number }
type Clock = { wall: () => number; mono: () => number }
type RateSlot = { minute: number; count: number; suppressed: number }
type State = {
  seq: number
  inflight: Map<number, Entry>
  dropped: number
  expired: number
  selfErrors: number
  gaps: Gap[]
  generation: { default: number; fulfillment: number }
  rate: Map<string, RateSlot>
  /** Monotonic reading of the last heartbeat tick; `null` while no heartbeat runs in this process. */
  lastTickMono: number | null
  enabledOverride: boolean | null
  clock: Clock
}

const realClock = (): Clock => ({ wall: () => Date.now(), mono: () => performance.now() })
const createState = (): State => ({
  seq: 0,
  inflight: new Map(),
  dropped: 0,
  expired: 0,
  selfErrors: 0,
  gaps: [],
  generation: { default: 0, fulfillment: 0 },
  rate: new Map(),
  lastTickMono: null,
  enabledOverride: null,
  clock: realClock(),
})

const STATE_KEY = Symbol.for("affisell.prisma.diagnostics")
const holder = globalThis as typeof globalThis & { [STATE_KEY]?: State }
const state: State = (holder[STATE_KEY] ??= createState())

const DEFAULT_ENABLED = process.env.NODE_ENV === "production" && process.env.AFFISELL_RUNTIME_DIAG !== "0"

export function isPrismaDiagnosticsEnabled(): boolean {
  return state.enabledOverride ?? DEFAULT_ENABLED
}

/** Counts a swallowed diagnostic failure. Never logs the failure itself (it could carry anything). */
export function noteDiagnosticSelfError(): void {
  try {
    state.selfErrors += 1
  } catch {
    /* nothing left to do */
  }
}

/** Closed character set and length: a name coming from outside can never smuggle free text into a log line. */
export function safeToken(value: unknown, max = 48): string {
  return String(value).replace(/[^A-Za-z0-9_.$-]/g, "_").slice(0, max) // no ':' or '/', so nothing can look like a URL
}

const processUptimeSeconds = (): number | undefined =>
  typeof process !== "undefined" && typeof process.uptime === "function" ? Math.round(process.uptime()) : undefined

function allowLog(event: string, minute: number): { allowed: boolean; suppressed: number } {
  let slot = state.rate.get(event)
  if (!slot) {
    if (state.rate.size >= 16) return { allowed: false, suppressed: 0 } // bounded even if called with unexpected event names
    slot = { minute, count: 0, suppressed: 0 }
    state.rate.set(event, slot)
  }
  if (slot.minute !== minute) {
    slot.minute = minute
    slot.count = 0
  }
  if (slot.count >= MAX_LOGS_PER_MINUTE) {
    slot.suppressed += 1
    return { allowed: false, suppressed: 0 }
  }
  slot.count += 1
  const suppressed = slot.suppressed
  slot.suppressed = 0
  return { allowed: true, suppressed }
}

/** The only place that writes a `[prisma_diag]` line. Rate limited; undefined fields are dropped. */
export function emitDiag(event: string, fields: Fields): void {
  try {
    const wall = state.clock.wall()
    const verdict = allowLog(event, Math.floor(wall / 60_000))
    if (!verdict.allowed) return
    const payload: Record<string, unknown> = { event, ts: new Date(wall).toISOString(), instance: RUNTIME_INSTANCE_ID, uptime_s: processUptimeSeconds() }
    for (const [key, value] of Object.entries(fields)) if (value !== undefined) payload[key] = value
    if (payload.uptime_s === undefined) delete payload.uptime_s
    if (verdict.suppressed > 0) payload.suppressed = verdict.suppressed
    logBusiness(PRISMA_DIAG_LOG_MODULE, payload)
  } catch {
    noteDiagnosticSelfError()
  }
}

export type ErrorClass = "unreachable" | "pool_timeout" | "closed" | "engine_not_ready" | "other_prisma" | "other"

/** Maps whatever was thrown to a CLOSED list. Looks at the Prisma code and the retryable-message patterns, never copies text. */
export function classifyPrismaFailure(error: unknown): ErrorClass {
  try {
    const code = prismaErrorCode(error)
    if (code === "P2024") return "pool_timeout"
    if (code === "P1001" || code === "P1002" || code === "P1017") return "unreachable"
    if (isNeonEngineNotReadyError(error)) return "engine_not_ready"
    if (isRetryablePrismaConnectionError(error)) return "closed"
    if (/^P\d{4}$/.test(code)) return "other_prisma"
  } catch {
    /* an exotic thrown value (throwing getter…) is simply "other" */
  }
  return "other"
}

const safeCode = (error: unknown): string | undefined => {
  try {
    const code = prismaErrorCode(error)
    return /^P\d{4}$/.test(code) ? code : undefined
  } catch {
    return undefined
  }
}

/** Closed list: an error class we did not expect is reported as "other", whatever text it carries in `.name`. */
const KNOWN_ERROR_NAMES: ReadonlySet<string> = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientInitializationError",
  "PrismaClientValidationError",
])

const safeName = (error: unknown): string => {
  try {
    if (!(error instanceof Error)) return typeof error
    return KNOWN_ERROR_NAMES.has(error.name) ? error.name : "other"
  } catch {
    return "unknown"
  }
}

/** Model and operation names come from Prisma's own metadata; they must still look like identifiers, or they are replaced. */
const MODEL_RE = /^[A-Z][A-Za-z0-9]{0,47}$/
const OPERATION_RE = /^\$?[A-Za-z]{1,32}$/
export function operationKey(model: string, operation: string): string {
  const op = OPERATION_RE.test(operation) ? operation : "unknown"
  if (model === "") return op // raw queries ($queryRaw, $executeRaw): no model
  return `${MODEL_RE.test(model) ? model : "unknown"}.${op}`
}

/**
 * Registers an operation. Returns an id (> 0) to hand back to `endPrismaOp`, or 0 when diagnostics are off, the registry is full or
 * anything went wrong — in which case the caller simply runs its original path.
 */
export function beginPrismaOp(model: string, operation: string): number {
  try {
    if (!isPrismaDiagnosticsEnabled()) return 0
    if (state.inflight.size >= MAX_INFLIGHT_OPS) {
      state.dropped += 1
      return 0
    }
    const id = ++state.seq
    state.inflight.set(id, {
      wall: state.clock.wall(),
      mono: state.clock.mono(),
      key: operationKey(model, operation),
      attempts: 0,
      generation: state.generation.default,
    })
    return id
  } catch {
    noteDiagnosticSelfError()
    return 0
  }
}

/** One more call of the underlying `query` (first attempt included). */
export function countPrismaAttempt(id: number): void {
  try {
    const entry = state.inflight.get(id)
    if (entry) entry.attempts += 1
  } catch {
    noteDiagnosticSelfError()
  }
}

/**
 * Sum of the event-loop gaps RECORDED SO FAR that overlap [startWall, endWall]. A gap that the heartbeat has not reported yet is not
 * in this sum, so `0` says nothing about whether the interval crossed one (see the header: `tick_age_ms` is the other measure).
 */
export function gapOverlapMs(startWall: number, endWall: number): number {
  let total = 0
  for (const gap of state.gaps) {
    const overlap = Math.min(endWall, gap.endWall) - Math.max(startWall, gap.startWall)
    if (overlap > 0) total += overlap
  }
  return Math.round(total)
}

/**
 * Removes the operation from the registry (FIRST, unconditionally) and logs it if it is worth a line: a connection-class failure,
 * or an operation of `SLOW_OP_MS` or more, or one that lasted a second and overlapped a gap already reported. `gap_overlap_reported_ms`
 * and `tick_age_ms` are two separate measures (see the header); the logging rule above uses only the first, so an operation under
 * `SLOW_OP_MS` that ended before the late tick is not logged for that reason alone — the `RUNTIME_GAP` line still lists it as in flight.
 */
export function endPrismaOp(id: number, failed: boolean, error: unknown, circuitAtStart: boolean): void {
  if (id === 0) return
  try {
    const entry = state.inflight.get(id)
    state.inflight.delete(id)
    if (!entry) return // swept as expired
    const nowMono = state.clock.mono()
    const durationMs = Math.round(nowMono - entry.mono)
    const tickAgeMs = state.lastTickMono === null ? undefined : Math.max(0, Math.round(nowMono - state.lastTickMono))
    const overlapMs = gapOverlapMs(entry.wall, state.clock.wall())
    const errorClass = failed ? classifyPrismaFailure(error) : undefined
    const connectionClass = errorClass !== undefined && errorClass !== "other" && errorClass !== "other_prisma"
    if (!(connectionClass || durationMs >= SLOW_OP_MS || (overlapMs > 0 && durationMs >= 1_000))) return
    const circuitNow = isPrismaCircuitOpen()
    emitDiag(failed ? "OP_ERROR" : "OP_SLOW", {
      op: entry.key,
      outcome: failed ? "error" : "ok",
      duration_ms: durationMs, // monotonic clock: may understate a suspension (see the header)
      attempts: entry.attempts,
      error_class: errorClass,
      error_code: failed ? safeCode(error) : undefined,
      error_name: failed ? safeName(error) : undefined,
      circuit_at_start: circuitAtStart,
      circuit_at_end: circuitNow,
      // closed at start and open at the end: ANOTHER concurrent operation may be the one that opened it — no causality is claimed
      circuit_opened_during: !circuitAtStart && circuitNow,
      client_gen_start: entry.generation,
      client_gen_now: state.generation.default,
      gap_overlap_reported_ms: overlapMs, // only gaps already reported by the heartbeat: 0 is NOT "no gap crossed"
      tick_age_ms: tickAgeMs, // time since the last heartbeat tick; large = no timer ran for that long (omitted without a heartbeat); monotonic clock: may understate a suspension
      inflight_now: state.inflight.size,
    })
  } catch {
    noteDiagnosticSelfError()
  }
}

/**
 * A snapshot never invents a value. `count` / `oldestAgeMs` are `null` when they could not be established — they are not 0:
 *  - `oldestAgeMs` is `null` when the diagnostic clock cannot be read: ages are unknown, but `count` and `ops` come from the registry
 *    itself and stay valid (the expiry sweep, which needs ages, is skipped for that snapshot);
 *  - `count` is `null` only if even counting the registry failed.
 */
export type InflightSnapshot = { count: number | null; oldestAgeMs: number | null; ops: string }

/** What is in flight right now (and sweeps entries older than `INFLIGHT_EXPIRE_MS`). `ops` is `Model.operation:count`, 4 keys at most. */
export function snapshotInflight(): InflightSnapshot {
  let nowMono: number | null = null
  try {
    const reading = state.clock.mono()
    nowMono = Number.isFinite(reading) ? reading : null
  } catch {
    nowMono = null
  }
  if (nowMono === null) noteDiagnosticSelfError()
  try {
    let oldest = 0
    const byKey = new Map<string, number>()
    for (const [id, entry] of state.inflight) {
      if (nowMono !== null) {
        const age = nowMono - entry.mono
        if (age > INFLIGHT_EXPIRE_MS) {
          state.inflight.delete(id)
          state.expired += 1
          continue
        }
        if (age > oldest) oldest = age
      }
      byKey.set(entry.key, (byKey.get(entry.key) ?? 0) + 1)
    }
    const ops = [...byKey.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([key, n]) => `${key}:${n}`)
      .join(",")
      .slice(0, 120)
    return { count: state.inflight.size, oldestAgeMs: nowMono === null ? null : Math.round(oldest), ops }
  } catch {
    noteDiagnosticSelfError()
    return { count: null, oldestAgeMs: null, ops: "" }
  }
}

/**
 * Remembers an event-loop gap (bounded history) so later operations can say how much of their life it covered. Bounds that are not
 * finite, or not strictly increasing, are refused: a gap is only recorded from two valid readings.
 */
export function recordGap(startWall: number, endWall: number): void {
  try {
    if (!Number.isFinite(startWall) || !Number.isFinite(endWall) || !(endWall > startWall)) return
    state.gaps.push({ startWall, endWall })
    while (state.gaps.length > MAX_GAP_HISTORY) state.gaps.shift()
  } catch {
    noteDiagnosticSelfError()
  }
}

/**
 * A heartbeat tick fired (or the heartbeat started): from now on operations ending measure `tick_age_ms` from this instant.
 * If the diagnostic clock cannot be read the stamp is CLEARED, not kept: an old stamp would make `tick_age_ms` grow as if no timer
 * had run, when the truth is only that this tick could not be timed. Nothing is claimed until the next successful stamp.
 */
export function noteHeartbeatTick(): void {
  try {
    const reading = state.clock.mono()
    state.lastTickMono = Number.isFinite(reading) ? reading : null
  } catch {
    state.lastTickMono = null
    noteDiagnosticSelfError()
  }
}

/** The heartbeat is gone (tests only in practice): `tick_age_ms` is omitted rather than growing forever. */
export function noteHeartbeatStopped(): void {
  state.lastTickMono = null
}

export function diagnosticCounters(): { dropped: number; expired: number; selfErrors: number } {
  return { dropped: state.dropped, expired: state.expired, selfErrors: state.selfErrors }
}

/** A Prisma client was created (cold start, or after `resetPrismaClient`). */
export function noteClientCreated(kind: "default" | "fulfillment"): void {
  try {
    state.generation[kind] += 1
    if (!isPrismaDiagnosticsEnabled()) return
    emitDiag("CLIENT_CREATED", { kind, generation: state.generation[kind] })
  } catch {
    noteDiagnosticSelfError()
  }
}

/** @internal tests only */
export function __setPrismaDiagnosticsEnabledForTests(value: boolean | null): void {
  state.enabledOverride = value
}

/** @internal tests only */
export function __setPrismaDiagnosticsClockForTests(clock: Clock | null): void {
  state.clock = clock ?? realClock()
}

/** @internal tests only */
export function __prismaDiagnosticsStateForTests(): { inflight: number; gaps: number; rateSlots: number; generation: { default: number; fulfillment: number } } {
  return { inflight: state.inflight.size, gaps: state.gaps.length, rateSlots: state.rate.size, generation: { ...state.generation } }
}

/** @internal tests only */
export function __resetPrismaDiagnosticsForTests(): void {
  const fresh = createState()
  state.seq = fresh.seq
  state.inflight.clear()
  state.dropped = 0
  state.expired = 0
  state.selfErrors = 0
  state.gaps.length = 0
  state.generation.default = 0
  state.generation.fulfillment = 0
  state.rate.clear()
  state.lastTickMono = null
  state.enabledOverride = null
  state.clock = realClock()
}
