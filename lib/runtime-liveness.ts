import "server-only"

import { isNextProductionBuildPhase } from "@/lib/build-time-database"
import {
  emitDiag,
  isPrismaDiagnosticsEnabled,
  noteDiagnosticSelfError,
  noteHeartbeatStopped,
  noteHeartbeatTick,
  recordGap,
  safeToken,
  snapshotInflight,
  diagnosticCounters,
  type InflightSnapshot,
} from "@/lib/prisma-diagnostics"

/**
 * Event-loop heartbeat (`[prisma_diag] RUNTIME_GAP`). One `setInterval` of 1 s, `unref()`-ed, started once per process from
 * instrumentation.ts. Each tick compares the wall clock and the monotonic clock with the previous tick; when a tick arrives more than
 * `LIVENESS_GAP_REPORT_MS` late it logs how long the loop did not run, how much CPU the process (all threads) and the main thread
 * consumed meanwhile, and what was in flight at the previous tick.
 *
 * WHAT THIS CAN AND CANNOT SAY — do not read more into it than this:
 *  - A late tick means no timer ran for that long. It does not say why. A process paused as a whole, a main thread saturated by
 *    synchronous JavaScript, and a main thread blocked without CPU all produce it.
 *  - `cpu_main_ms` close to the gap  → the main thread was busy (saturated loop).
 *    `cpu_proc_ms` and `cpu_main_ms` both ≈ 0 → no thread consumed CPU: compatible with a paused process, but ALSO with a
 *    synchronous wait without CPU (none exists on this code path — audited — but the measure alone cannot exclude it).
 *    `cpu_main_ms` ≈ 0 and `cpu_other_ms` high → other threads kept working while the main thread did not run.
 *  - `cpu_other_ms` is process minus main thread: it includes libuv, GC and the Prisma engine threads without telling them apart.
 *  - What the clocks do while a process is suspended depends on their real semantics, and that has NOT been established for the
 *    production environment: neither the wall clock (`Date.now()`) nor the monotonic clock (`performance.now()`) is known to count the
 *    whole suspended time. `gap_ms` (wall) and `gap_mono_ms` (monotonic) can therefore diverge, and `gap_ms` ≈ `gap_mono_ms` does not
 *    prove a pause. `clock_skew_ms` makes that disagreement observable; it does not prove its cause by itself (a stepped wall clock,
 *    or a monotonic clock that does not count the suspended time, would both produce it).
 *  - `inflight_before` is the registry at the PREVIOUS tick (the state at the start of the gap). The registry at the late tick is
 *    `inflight_now`: completions can already have been processed by then. After a pause the loop can handle an operation's completion
 *    BEFORE this late tick runs; that operation's own line then carries `gap_overlap_reported_ms: 0` (the gap is not recorded yet) and a
 *    large `tick_age_ms` (see prisma-diagnostics.ts). Every tick stamps the time it ran (`noteHeartbeatTick`) as its FIRST step, before any
 *    probe is read. `tick_age_ms` (like `duration_ms`) is measured on the monotonic clock: if that clock does not count all the time a
 *    process is suspended, both can understate it. `gap_ms` (wall clock) is the other reference, with the same reservation.
 *  - A CPU probe that throws makes only its own figures unavailable: `cpu_proc_ms` / `cpu_main_ms` / `cpu_other_ms` are OMITTED (never
 *    zero) when the sample at either end of the gap is missing, and the gap itself is detected and logged all the same.
 *  - UNMEASURED TICKS. A gap is the distance between two ticks whose wall AND monotonic readings were both valid (finite numbers). A tick
 *    whose wall or monotonic probe throws or returns a non-number fired, but cannot be timed: it is "unmeasured". It leaves every
 *    reference (`lastWall`, `lastMono`, CPU samples, in-flight snapshot) untouched, produces no `RUNTIME_GAP`, and calls no `recordGap`
 *    (no gap is ever built from a bound that was not read). At the next valid tick the references are RE-ESTABLISHED from that tick and
 *    ONE `RUNTIME_UNMEASURED` line says how many ticks could not be timed and which probe(s) failed. That line carries NO duration: the
 *    time spent unmeasured is not a measurement, and a real pause hidden inside it is flagged as unmeasured, never reported as a gap.
 *    Gaps after that tick are measured from it, normally. A probe that never recovers writes no line at all (only the self-error counter).
 *  - Nothing here observes Vercel. A gap is a measured fact about this process; "the platform suspended the instance" remains an
 *    inference, to be drawn (or not) from many events, together with the database-side sampling.
 *
 * Passive and bounded: no Prisma, no network, no `after()` / `waitUntil()`, no allocation that grows. The timer never keeps the
 * process alive. Skipped during `next build`. Active in production only (see prisma-diagnostics.ts).
 */

export const LIVENESS_INTERVAL_MS = 1_000
export const LIVENESS_GAP_REPORT_MS = 5_000
export const LIVENESS_CLOCK_JUMP_MS = 2_000

export type Cpu = { user: number; system: number }
export type LivenessProbes = {
  wall: () => number
  mono: () => number
  cpuProcess: () => Cpu
  /** `null` when `process.threadCpuUsage` does not exist (Node < 22.19 / 23.9): the fields are then simply omitted. */
  cpuThread: (() => Cpu) | null
}

const HANDLE_KEY = Symbol.for("affisell.runtime.liveness")
const holder = globalThis as typeof globalThis & { [HANDLE_KEY]?: { stop: () => void } }

function defaultProbes(): LivenessProbes {
  const threadCpuUsage = (process as unknown as { threadCpuUsage?: () => Cpu }).threadCpuUsage
  return {
    wall: () => Date.now(),
    mono: () => performance.now(),
    cpuProcess: () => process.cpuUsage(),
    cpuThread: typeof threadCpuUsage === "function" ? () => threadCpuUsage.call(process) : null,
  }
}

const totalMs = (cpu: Cpu): number => (cpu.user + cpu.system) / 1000

/** A clock probe that throws or returns something that is not a finite number is "unreadable" (`null`): it never yields a bound. */
function readClock(read: () => number): number | null {
  try {
    const value = read()
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/** A probe that is missing or throws (unsupported platform, restricted sandbox…) makes only that measure unavailable (`null`), never the heartbeat. */
function readCpu(read: (() => Cpu) | null): Cpu | null {
  if (!read) return null
  try {
    const { user, system } = read() // read here, inside the try: a sample that is null, non-numeric or whose getters throw is just "unavailable"
    return Number.isFinite(user) && Number.isFinite(system) ? { user, system } : null
  } catch {
    return null
  }
}

/** CPU milliseconds consumed between two samples, or `null` when either sample is unavailable. */
const cpuDeltaMs = (current: Cpu | null, previous: Cpu | null): number | null =>
  current && previous ? totalMs(current) - totalMs(previous) : null

export type LivenessHandle = { stop: () => void; /** For tests: must stay false (the timer is `unref()`-ed). */ hasRef: () => boolean }

/**
 * Starts the heartbeat once per process. Returns the handle, or `null` when diagnostics are off, during `next build`, or when a
 * heartbeat already runs in this process (several bundles / repeated `register()` calls never create a second timer).
 */
export function startRuntimeLiveness(options: { probes?: LivenessProbes; intervalMs?: number } = {}): LivenessHandle | null {
  try {
    if (!isPrismaDiagnosticsEnabled()) return null
    if (isNextProductionBuildPhase()) return null
    if (holder[HANDLE_KEY]) return null

    const probes = options.probes ?? defaultProbes()
    const intervalMs = options.intervalMs ?? LIVENESS_INTERVAL_MS
    const startWall = readClock(probes.wall)
    const startMono = readClock(probes.mono)
    if (startWall === null || startMono === null) {
      noteDiagnosticSelfError() // no valid reference to measure from: the heartbeat does not start
      return null
    }
    let lastWall: number = startWall
    let lastMono: number = startMono
    let lastCpuProcess = readCpu(probes.cpuProcess)
    let lastCpuThread = readCpu(probes.cpuThread)
    let before: InflightSnapshot = snapshotInflight()
    // Ticks whose wall or monotonic probe could not be read since the last valid tick (see "UNMEASURED TICKS" above). Three small
    // scalars: the state stays bounded however long a probe keeps failing.
    let unmeasuredTicks = 0
    let wallUnreadable = false
    let monoUnreadable = false

    emitDiag("RUNTIME_START", {
      node: safeToken(process.version, 16),
      thread_cpu: probes.cpuThread !== null && lastCpuThread !== null,
      region: process.env.VERCEL_REGION ? safeToken(process.env.VERCEL_REGION, 16) : undefined,
      interval_ms: intervalMs,
      gap_report_ms: LIVENESS_GAP_REPORT_MS,
    })

    const tick = (): void => {
      noteHeartbeatTick() // FIRST step (it never throws): the timer fired, so operations ending from now on measure `tick_age_ms` from here
      let measured = false
      try {
        const wall = readClock(probes.wall)
        const mono = readClock(probes.mono)
        if (wall === null) wallUnreadable = true
        if (mono === null) monoUnreadable = true
        if (wall === null || mono === null) {
          noteDiagnosticSelfError() // counted; references are left exactly as they were, nothing is recorded or reported for this tick
        } else {
          const cpuProcess = readCpu(probes.cpuProcess)
          const cpuThread = readCpu(probes.cpuThread)
          const now = snapshotInflight()

          try {
            if (unmeasuredTicks > 0) {
              // The previous interval could not be timed: say so, claim no duration, record no gap. The references are re-established below.
              emitDiag("RUNTIME_UNMEASURED", {
                unmeasured_ticks: unmeasuredTicks,
                unreadable: wallUnreadable && monoUnreadable ? "wall+mono" : wallUnreadable ? "wall" : monoUnreadable ? "mono" : "other",
                expected_ms: intervalMs,
              })
            } else {
              const gapWall = wall - lastWall
              const gapMono = mono - lastMono
              if (gapWall < -LIVENESS_CLOCK_JUMP_MS) {
                emitDiag("RUNTIME_CLOCK_JUMP", { wall_delta_ms: Math.round(gapWall), mono_delta_ms: Math.round(gapMono) })
              } else if (Math.max(gapWall, gapMono) - intervalMs > LIVENESS_GAP_REPORT_MS) {
                // CPU figures need a valid sample at BOTH ends of the gap; a missing one is omitted, never reported as 0.
                const processMs = cpuDeltaMs(cpuProcess, lastCpuProcess)
                const mainMs = cpuDeltaMs(cpuThread, lastCpuThread)
                const counters = diagnosticCounters()
                recordGap(lastWall, wall) // both bounds are valid readings of two consecutive MEASURED ticks
                emitDiag("RUNTIME_GAP", {
                  gap_ms: Math.round(gapWall),
                  gap_mono_ms: Math.round(gapMono),
                  clock_skew_ms: Math.round(gapWall - gapMono),
                  expected_ms: intervalMs,
                  cpu_proc_ms: processMs === null ? undefined : Math.round(processMs),
                  cpu_main_ms: mainMs === null ? undefined : Math.round(mainMs),
                  cpu_other_ms: processMs === null || mainMs === null ? undefined : Math.max(0, Math.round(processMs - mainMs)),
                  inflight_before: before.count ?? undefined, // undefined = unknown, never a fabricated 0
                  oldest_before_ms: before.oldestAgeMs ?? undefined,
                  ops_before: before.ops || undefined,
                  inflight_now: now.count ?? undefined,
                  expired: counters.expired,
                  dropped: counters.dropped,
                })
              }
            }
          } catch {
            noteDiagnosticSelfError() // a failed report must not turn the NEXT interval into a false, longer gap: the references below still advance
          }

          unmeasuredTicks = 0
          wallUnreadable = false
          monoUnreadable = false
          lastWall = wall
          lastMono = mono
          lastCpuProcess = cpuProcess
          lastCpuThread = cpuThread
          before = now
          measured = true
        }
      } catch {
        noteDiagnosticSelfError() // the heartbeat keeps running; the failure is only counted
      }
      if (!measured) unmeasuredTicks += 1 // a tick that did not complete is never silently folded into the next gap
    }

    const timer = setInterval(tick, intervalMs)
    timer.unref() // a diagnostic timer must never keep the process (or a build) alive

    const handle: LivenessHandle = {
      stop: () => {
        clearInterval(timer)
        if (holder[HANDLE_KEY] === handle) {
          delete holder[HANDLE_KEY]
          noteHeartbeatStopped()
        }
      },
      hasRef: () => timer.hasRef(),
    }
    holder[HANDLE_KEY] = handle
    noteHeartbeatTick() // stamped only once the timer exists and the handle is registered: nothing can throw between here and `return`
    return handle
  } catch {
    noteDiagnosticSelfError()
    return null
  }
}

/** @internal tests only */
export function __stopRuntimeLivenessForTests(): void {
  holder[HANDLE_KEY]?.stop()
}
