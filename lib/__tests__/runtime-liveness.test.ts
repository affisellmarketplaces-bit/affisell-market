import { readFileSync } from "node:fs"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const sink = vi.hoisted(() => ({ lines: [] as { module: string; payload: Record<string, unknown> }[], throwOnLog: false }))
vi.mock("@/lib/business-log", () => ({
  logBusiness: (module: string, payload: Record<string, unknown>) => {
    if (sink.throwOnLog) throw new Error("log sink down")
    sink.lines.push({ module, payload })
  },
}))

import {
  LIVENESS_GAP_REPORT_MS,
  LIVENESS_INTERVAL_MS,
  __stopRuntimeLivenessForTests,
  startRuntimeLiveness,
  type LivenessProbes,
} from "@/lib/runtime-liveness"
import {
  __prismaDiagnosticsStateForTests,
  __resetPrismaDiagnosticsForTests,
  __setPrismaDiagnosticsClockForTests,
  __setPrismaDiagnosticsEnabledForTests,
  beginPrismaOp,
  diagnosticCounters,
  endPrismaOp,
} from "@/lib/prisma-diagnostics"
import { RUNTIME_INSTANCE_ID } from "@/lib/runtime-instance"

const p1017 = () => Object.assign(new Error("Server has closed the connection."), { code: "P1017" })

/** All time and CPU readings are injected: a 300 s "pause" costs nothing. */
function harness(options: { thread?: boolean } = {}) {
  const s = {
    wall: 1_800_000_000_000,
    mono: 50_000,
    proc: { user: 0, system: 0 },
    thread: { user: 0, system: 0 },
    throwProcess: false,
    throwThread: false,
    /** Replaces the process-CPU sample with an exotic value (null, NaN, throwing getters…). */
    processSample: null as (() => unknown) | null,
    /** The heartbeat's own clock probes fail (throw) or return a non-number. */
    throwWall: false,
    throwMono: false,
    nanWall: false,
    /** The DIAGNOSTIC clock (`state.clock`, used by the registry and `tick_age_ms`) fails; the heartbeat's probes are fine. */
    diagClockDown: false,
  }
  const probes: LivenessProbes = {
    wall: () => {
      if (s.throwWall) throw new Error("wall unavailable")
      return s.nanWall ? Number.NaN : s.wall
    },
    mono: () => {
      if (s.throwMono) throw new Error("mono unavailable")
      return s.mono
    },
    cpuProcess: () => {
      if (s.throwProcess) throw new Error("cpuUsage unavailable")
      if (s.processSample) return s.processSample() as { user: number; system: number }
      return { ...s.proc }
    },
    cpuThread:
      options.thread === false
        ? null
        : () => {
            if (s.throwThread) throw new Error("threadCpuUsage unavailable")
            return { ...s.thread }
          },
  }
  __setPrismaDiagnosticsClockForTests({
    wall: () => s.wall,
    mono: () => {
      if (s.diagClockDown) throw new Error("diagnostic clock down")
      return s.mono
    },
  })
  /** One timer tick, as seen by the probes after `ms` of (wall AND monotonic) time and the given CPU consumption (ms). */
  const tick = (ms: number = LIVENESS_INTERVAL_MS, cpu: { proc?: number; main?: number } = {}) => {
    s.wall += ms
    s.mono += ms
    s.proc.user += (cpu.proc ?? 0) * 1000
    s.thread.user += (cpu.main ?? 0) * 1000
    vi.advanceTimersByTime(LIVENESS_INTERVAL_MS)
  }
  /**
   * `ms` go by on both clocks and NO timer runs: the process was paused / the loop blocked. What the event loop does next is up to the
   * test: either an operation completes first (`endPrismaOp`), or the late tick runs first (`tick(0)`).
   */
  const pause = (ms: number, cpu: { proc?: number; main?: number } = {}) => {
    s.wall += ms
    s.mono += ms
    s.proc.user += (cpu.proc ?? 0) * 1000
    s.thread.user += (cpu.main ?? 0) * 1000
  }
  return { s, probes, tick, pause }
}

const events = (name: string) => sink.lines.map((l) => l.payload).filter((p) => p.event === name)

beforeEach(() => {
  sink.lines.length = 0
  sink.throwOnLog = false
  __resetPrismaDiagnosticsForTests()
  __setPrismaDiagnosticsEnabledForTests(true)
  vi.useFakeTimers()
})

afterEach(() => {
  __stopRuntimeLivenessForTests()
  __resetPrismaDiagnosticsForTests()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("start", () => {
  it("announces itself once, with the facts needed to read the later lines", () => {
    vi.stubEnv("VERCEL_REGION", "iad1")
    const { probes } = harness()
    const handle = startRuntimeLiveness({ probes })
    expect(handle).not.toBeNull()
    expect(events("RUNTIME_START")).toHaveLength(1)
    expect(events("RUNTIME_START")[0]).toMatchObject({
      instance: RUNTIME_INSTANCE_ID,
      thread_cpu: true,
      region: "iad1",
      interval_ms: LIVENESS_INTERVAL_MS,
      gap_report_ms: LIVENESS_GAP_REPORT_MS,
    })
    expect(String(events("RUNTIME_START")[0]!.node)).toMatch(/^v\d+\.\d+\.\d+$/)
  })

  it("runs ONE heartbeat per process: a second start (another bundle, a repeated register()) creates no second timer", () => {
    const { probes } = harness()
    const first = startRuntimeLiveness({ probes })
    expect(startRuntimeLiveness({ probes })).toBeNull()
    expect(startRuntimeLiveness()).toBeNull()
    expect(vi.getTimerCount()).toBe(1)
    first!.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(startRuntimeLiveness({ probes })).not.toBeNull() // restartable once stopped
    expect(vi.getTimerCount()).toBe(1)
  })

  it("never keeps the process alive: the timer is unref'd (fake timers)", () => {
    const { probes } = harness()
    expect(startRuntimeLiveness({ probes })!.hasRef()).toBe(false)
  })

  it("never keeps the process alive: with REAL timers an unref'd interval adds no active Timeout resource", () => {
    vi.useRealTimers()
    const { probes } = harness()
    const before = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length
    const handle = startRuntimeLiveness({ probes, intervalMs: 25 })!
    expect(handle.hasRef()).toBe(false)
    expect(process.getActiveResourcesInfo().filter((r) => r === "Timeout").length).toBe(before)
    handle.stop()
  })

  it("is inert when diagnostics are off, and during `next build`", () => {
    const { probes } = harness()
    __setPrismaDiagnosticsEnabledForTests(false)
    expect(startRuntimeLiveness({ probes })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(sink.lines).toEqual([])

    __setPrismaDiagnosticsEnabledForTests(true)
    vi.stubEnv("NEXT_PHASE", "phase-production-build")
    expect(startRuntimeLiveness({ probes })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("a failing log sink cannot stop the heartbeat from starting", () => {
    const { probes } = harness()
    sink.throwOnLog = true
    expect(startRuntimeLiveness({ probes })).not.toBeNull()
    expect(vi.getTimerCount()).toBe(1)
  })
})

describe("what a tick reports", () => {
  it("stays silent while ticks arrive on time (30 s of normal operation)", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    for (let i = 0; i < 30; i++) tick(LIVENESS_INTERVAL_MS, { proc: 3, main: 2 })
    expect(events("RUNTIME_GAP")).toEqual([])
    expect(vi.getTimerCount()).toBe(1) // no timer is created per tick
  })

  it("reports a 300 s stall with NO cpu consumed anywhere: gap, cpu_proc 0, cpu_main 0, cpu_other 0 (a paused process, or a sync wait without CPU)", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    tick(300_000)
    expect(events("RUNTIME_GAP")).toHaveLength(1)
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 300_000, gap_mono_ms: 300_000, clock_skew_ms: 0, expected_ms: 1_000, cpu_proc_ms: 0, cpu_main_ms: 0, cpu_other_ms: 0 })
  })

  it("a saturated main thread shows up as cpu_main ≈ gap", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    tick(10_000, { proc: 9_900, main: 9_800 })
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 10_000, cpu_proc_ms: 9_900, cpu_main_ms: 9_800, cpu_other_ms: 100 })
  })

  it("a blocked main thread while other threads work shows up as cpu_main ≈ 0 and cpu_other high", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    tick(10_000, { proc: 9_000, main: 5 })
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ cpu_proc_ms: 9_000, cpu_main_ms: 5, cpu_other_ms: 8_995 })
  })

  it("the threshold is strict: interval + 5 s is not reported, one millisecond more is", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    tick(LIVENESS_INTERVAL_MS + LIVENESS_GAP_REPORT_MS)
    expect(events("RUNTIME_GAP")).toHaveLength(0)
    tick(LIVENESS_INTERVAL_MS + LIVENESS_GAP_REPORT_MS + 1)
    expect(events("RUNTIME_GAP")).toHaveLength(1)
  })

  it("reports what was in flight at the PREVIOUS tick even if those operations completed before the late tick ran", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    const a = beginPrismaOp("AffiliateProduct", "findMany")
    const b = beginPrismaOp("Store", "findMany")
    const c = beginPrismaOp("AffiliateProduct", "findMany")
    tick(LIVENESS_INTERVAL_MS) // normal tick: the registry is snapshotted here
    endPrismaOp(a, false, undefined, false) // completions are processed as soon as the loop resumes…
    endPrismaOp(b, false, undefined, false)
    endPrismaOp(c, false, undefined, false)
    tick(120_000) // …i.e. before the late timer fires
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ inflight_before: 3, ops_before: "AffiliateProduct.findMany:2,Store.findMany:1", inflight_now: 0 })
    expect(Number(events("RUNTIME_GAP")[0]!.oldest_before_ms)).toBeGreaterThanOrEqual(0)
  })

  it("an operation that completes AFTER the late tick logs how much of its life the already-reported gap covered", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    const id = beginPrismaOp("Product", "findMany")
    tick(300_000)
    endPrismaOp(id, true, Object.assign(new Error("closed"), { code: "P1017" }), false)
    const err = events("OP_ERROR")[0]!
    expect(err).toMatchObject({ op: "Product.findMany", error_code: "P1017", error_class: "unreachable", tick_age_ms: 0 })
    expect(err.gap_overlap_reported_ms).toBeGreaterThanOrEqual(299_000)
    expect("gap_overlap_ms" in err).toBe(false) // the old name promised more than the measure gives
  })

  it("a wall clock stepped BACKWARD is a clock jump, not a gap", () => {
    const { probes, s } = harness()
    startRuntimeLiveness({ probes })
    s.wall -= 10_000
    s.mono += LIVENESS_INTERVAL_MS
    vi.advanceTimersByTime(LIVENESS_INTERVAL_MS)
    expect(events("RUNTIME_GAP")).toHaveLength(0)
    expect(events("RUNTIME_CLOCK_JUMP")).toHaveLength(1)
    expect(events("RUNTIME_CLOCK_JUMP")[0]).toMatchObject({ wall_delta_ms: -10_000, mono_delta_ms: 1_000 })
  })

  it("a wall clock stepped FORWARD without monotonic time is reported with its skew so it can be discounted", () => {
    const { probes, s } = harness()
    startRuntimeLiveness({ probes })
    s.wall += 300_000
    s.mono += LIVENESS_INTERVAL_MS
    vi.advanceTimersByTime(LIVENESS_INTERVAL_MS)
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 300_000, gap_mono_ms: 1_000, clock_skew_ms: 299_000 })
  })

  it("keeps a bounded memory of past gaps", () => {
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    for (let i = 0; i < 20; i++) tick(10_000)
    expect(__prismaDiagnosticsStateForTests().gaps).toBeLessThanOrEqual(8)
  })
})

describe("CPU probes that are missing or fail", () => {
  it("without thread CPU (Node < 22.19 / 23.9): the heartbeat works, thread-dependent fields are omitted, START says so", () => {
    const { probes, tick } = harness({ thread: false })
    startRuntimeLiveness({ probes })
    tick(60_000, { proc: 4 })
    expect(events("RUNTIME_START")[0]).toMatchObject({ thread_cpu: false })
    const gap = events("RUNTIME_GAP")[0]!
    expect(gap).toMatchObject({ gap_ms: 60_000, cpu_proc_ms: 4 })
    expect("cpu_main_ms" in gap).toBe(false)
    expect("cpu_other_ms" in gap).toBe(false)
  })

  it("a thread-CPU probe that throws is treated as unavailable for that tick; nothing else changes", () => {
    const { probes, tick, s } = harness()
    startRuntimeLiveness({ probes })
    s.throwThread = true
    tick(60_000, { proc: 4 })
    const gap = events("RUNTIME_GAP")[0]!
    expect(gap).toMatchObject({ gap_ms: 60_000, cpu_proc_ms: 4 })
    expect("cpu_main_ms" in gap).toBe(false)
    expect(diagnosticCounters().selfErrors).toBe(0)
  })

  describe("E2 — a process-CPU probe that fails never hides a gap", () => {
    const FIELDS = ["cpu_proc_ms", "cpu_other_ms"] as const

    it("fails on EVERY call, from the very first one: the heartbeat starts, the gap is detected and logged, thread CPU is kept", () => {
      const { probes, tick, s } = harness()
      s.throwProcess = true
      expect(startRuntimeLiveness({ probes })).not.toBeNull()
      expect(events("RUNTIME_START")).toHaveLength(1)
      const id = beginPrismaOp("Product", "findMany")
      expect(() => tick(LIVENESS_INTERVAL_MS, { main: 2 })).not.toThrow()
      tick(300_000, { main: 7 })
      const gap = events("RUNTIME_GAP")[0]!
      expect(events("RUNTIME_GAP")).toHaveLength(1)
      expect(gap).toMatchObject({ gap_ms: 300_000, gap_mono_ms: 300_000, clock_skew_ms: 0, cpu_main_ms: 7, inflight_before: 1, inflight_now: 1 })
      for (const field of FIELDS) expect(field in gap, `${field} must be omitted, not 0`).toBe(false)
      expect(diagnosticCounters().selfErrors).toBe(0) // an unavailable measure is not a diagnostic failure
      endPrismaOp(id, false, undefined, false)
      expect(vi.getTimerCount()).toBe(1)
    })

    it("a second and a third stall are reported too (the failure does not stop the detection after the first one)", () => {
      const { probes, tick, s } = harness()
      s.throwProcess = true
      startRuntimeLiveness({ probes })
      tick(60_000)
      tick(LIVENESS_INTERVAL_MS)
      tick(90_000)
      expect(events("RUNTIME_GAP").map((g) => g.gap_ms)).toEqual([60_000, 90_000])
    })

    it("both CPU probes fail on every call: the gap and the in-flight facts are still logged, with no CPU figure", () => {
      const { probes, tick, s } = harness()
      s.throwProcess = true
      s.throwThread = true
      startRuntimeLiveness({ probes })
      expect(events("RUNTIME_START")[0]).toMatchObject({ thread_cpu: false })
      beginPrismaOp("Store", "findMany")
      tick(LIVENESS_INTERVAL_MS)
      tick(120_000)
      const gap = events("RUNTIME_GAP")[0]!
      expect(gap).toMatchObject({ gap_ms: 120_000, inflight_before: 1, ops_before: "Store.findMany:1" })
      for (const field of ["cpu_proc_ms", "cpu_main_ms", "cpu_other_ms"]) expect(field in gap, field).toBe(false)
    })

    it("fails only AT the late tick: the figure needs a sample at both ends of the gap, so it is omitted — and the gap is logged", () => {
      const { probes, tick, s } = harness()
      startRuntimeLiveness({ probes })
      tick(LIVENESS_INTERVAL_MS, { proc: 3, main: 2 })
      s.throwProcess = true
      tick(60_000, { proc: 50, main: 4 })
      const gap = events("RUNTIME_GAP")[0]!
      expect(gap).toMatchObject({ gap_ms: 60_000, cpu_main_ms: 4 })
      for (const field of FIELDS) expect(field in gap, field).toBe(false)
    })

    it("fails at an ordinary tick and recovers: the first gap after recovery has no process figure (no sample at its start), the next one has", () => {
      const { probes, tick, s } = harness()
      startRuntimeLiveness({ probes })
      s.throwProcess = true
      tick(LIVENESS_INTERVAL_MS)
      s.throwProcess = false
      tick(60_000, { proc: 8, main: 6 })
      expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 60_000, cpu_main_ms: 6 })
      expect("cpu_proc_ms" in events("RUNTIME_GAP")[0]!).toBe(false)
      tick(60_000, { proc: 9, main: 6 })
      expect(events("RUNTIME_GAP")[1]).toMatchObject({ gap_ms: 60_000, cpu_proc_ms: 9, cpu_main_ms: 6, cpu_other_ms: 3 })
    })

    it.each([
      ["null", () => null],
      ["undefined", () => undefined],
      ["NaN fields", () => ({ user: Number.NaN, system: 0 })],
      ["non-numeric fields", () => ({ user: "abc", system: {} })],
      ["a sample whose getters throw", () => ({ get user(): number { throw new Error("getter") }, get system(): number { throw new Error("getter") } })],
    ])("an exotic process sample (%s) is just 'unavailable': the gap is logged without the process figures", (_name, sample) => {
      const { probes, tick, s } = harness()
      startRuntimeLiveness({ probes })
      s.processSample = sample
      expect(() => tick(LIVENESS_INTERVAL_MS)).not.toThrow()
      tick(60_000, { main: 5 })
      const gap = events("RUNTIME_GAP")[0]!
      expect(gap).toMatchObject({ gap_ms: 60_000, cpu_main_ms: 5 })
      for (const field of FIELDS) expect(field in gap, field).toBe(false)
      expect(diagnosticCounters().selfErrors).toBe(0)
    })

    it("a log sink that throws at the late tick loses that one line only: the baselines still advance, so the next ordinary tick reports no false, longer gap", () => {
      const { probes, tick } = harness()
      startRuntimeLiveness({ probes })
      sink.throwOnLog = true
      tick(300_000) // detected, but the line cannot be written
      sink.throwOnLog = false
      tick(LIVENESS_INTERVAL_MS)
      expect(events("RUNTIME_GAP")).toEqual([])
      expect(vi.getTimerCount()).toBe(1)
    })
  })

  describe("E1 — an operation can complete before the late tick records the gap", () => {
    it("the exact order that exposed the defect: completion first (overlap reported 0, tick_age_ms = the pause), RUNTIME_GAP right after", () => {
      const { probes, tick, pause } = harness()
      startRuntimeLiveness({ probes })
      const id = beginPrismaOp("Product", "findMany")
      tick(LIVENESS_INTERVAL_MS) // last ordinary tick: the registry holds the operation
      pause(300_000) // process paused: no timer runs
      endPrismaOp(id, true, p1017(), false) // the loop resumes and handles the completion BEFORE the due timer

      const err = events("OP_ERROR")[0]!
      expect(err).toMatchObject({ op: "Product.findMany", error_class: "unreachable", duration_ms: 301_000, gap_overlap_reported_ms: 0, tick_age_ms: 300_000 })
      expect(events("RUNTIME_GAP")).toEqual([]) // not recorded yet — which is exactly why the 0 above proves nothing

      tick(0) // the late tick
      expect(events("RUNTIME_GAP")).toHaveLength(1)
      expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 300_000, inflight_before: 1, inflight_now: 0 })
      expect(sink.lines.map((l) => l.payload.event)).toEqual(["RUNTIME_START", "OP_ERROR", "RUNTIME_GAP"])
    })

    it("the other order: late tick first, then the completion — the reported overlap covers the pause and tick_age_ms is back to ~0", () => {
      const { probes, tick, pause } = harness()
      startRuntimeLiveness({ probes })
      const id = beginPrismaOp("Product", "findMany")
      tick(LIVENESS_INTERVAL_MS)
      pause(300_000)
      tick(0) // late tick first
      endPrismaOp(id, true, p1017(), false)

      expect(sink.lines.map((l) => l.payload.event)).toEqual(["RUNTIME_START", "RUNTIME_GAP", "OP_ERROR"])
      const err = events("OP_ERROR")[0]!
      expect(err.gap_overlap_reported_ms).toBe(300_000)
      expect(err.tick_age_ms).toBe(0)
      expect(events("RUNTIME_GAP")[0]).toMatchObject({ inflight_before: 1, inflight_now: 1 }) // still in flight at the late tick
    })

    it("two operations of the same pause end on either side of the late tick: the reported overlap differs (0 vs positive), tick_age_ms tells them apart", () => {
      const { probes, tick, pause } = harness()
      startRuntimeLiveness({ probes })
      const early = beginPrismaOp("Product", "findMany")
      const late = beginPrismaOp("Store", "findMany")
      tick(LIVENESS_INTERVAL_MS)
      pause(300_000)
      endPrismaOp(early, true, p1017(), false) // completes before the late tick
      tick(0)
      endPrismaOp(late, true, p1017(), false) // completes after it

      const [first, second] = events("OP_ERROR") as [Record<string, unknown>, Record<string, unknown>]
      expect(first).toMatchObject({ op: "Product.findMany", gap_overlap_reported_ms: 0, tick_age_ms: 300_000 })
      expect(second).toMatchObject({ op: "Store.findMany", gap_overlap_reported_ms: 300_000, tick_age_ms: 0 })
    })

    it("with a loop that keeps turning, a slow operation shows a small tick_age_ms and no gap overlap (the figure is a fact about the heartbeat, not a verdict)", () => {
      const { probes, tick, pause } = harness()
      startRuntimeLiveness({ probes })
      const id = beginPrismaOp("Product", "findMany")
      for (let i = 0; i < 6; i++) tick(LIVENESS_INTERVAL_MS)
      pause(400) // 400 ms since the last tick, still within one interval
      endPrismaOp(id, false, undefined, false)
      expect(events("OP_SLOW")[0]).toMatchObject({ duration_ms: 6_400, gap_overlap_reported_ms: 0, tick_age_ms: 400 })
      expect(events("RUNTIME_GAP")).toEqual([])
    })

    it("stopping the heartbeat removes tick_age_ms (nothing is claimed without a heartbeat); a stale handle cannot clear a newer heartbeat's stamp", () => {
      const { probes, pause } = harness()
      const first = startRuntimeLiveness({ probes })!
      first.stop()
      const a = beginPrismaOp("Product", "findMany")
      pause(6_000)
      endPrismaOp(a, false, undefined, false)
      expect("tick_age_ms" in events("OP_SLOW")[0]!).toBe(false)

      sink.lines.length = 0
      const second = startRuntimeLiveness({ probes })!
      first.stop() // stale handle: must not touch the running heartbeat
      const b = beginPrismaOp("Product", "findMany")
      pause(6_000)
      endPrismaOp(b, false, undefined, false)
      expect(events("OP_SLOW")[0]).toMatchObject({ tick_age_ms: 6_000 }) // measured from the SECOND heartbeat's start stamp
      second.stop()
    })
  })

  it("the REAL probes work on this Node (cpuUsage and threadCpuUsage), and a missing threadCpuUsage is handled", () => {
    const original = Object.getOwnPropertyDescriptor(process, "threadCpuUsage")
    try {
      const handle = startRuntimeLiveness()!
      expect(events("RUNTIME_START")[0]).toMatchObject({ thread_cpu: typeof (process as unknown as { threadCpuUsage?: unknown }).threadCpuUsage === "function" })
      handle.stop()
      sink.lines.length = 0

      Object.defineProperty(process, "threadCpuUsage", { value: undefined, configurable: true, writable: true })
      const without = startRuntimeLiveness()
      expect(without).not.toBeNull()
      expect(events("RUNTIME_START")[0]).toMatchObject({ thread_cpu: false })
      without!.stop()
    } finally {
      if (original) Object.defineProperty(process, "threadCpuUsage", original)
      else delete (process as unknown as Record<string, unknown>).threadCpuUsage
    }
  })
})

type Harness = ReturnType<typeof harness>
const gapsInHistory = () => __prismaDiagnosticsStateForTests().gaps

describe("unmeasured ticks — a clock probe that fails never fabricates a gap, and never hides a later one", () => {
  /** How each case makes the heartbeat's wall / monotonic reading unusable, and what the marker line must call it. */
  const FAILURES: [string, (h: Harness) => void, (h: Harness) => void, string][] = [
    ["wall probe throws", (h) => void (h.s.throwWall = true), (h) => void (h.s.throwWall = false), "wall"],
    ["monotonic probe throws", (h) => void (h.s.throwMono = true), (h) => void (h.s.throwMono = false), "mono"],
    ["both probes throw", (h) => void (h.s.throwWall = h.s.throwMono = true), (h) => void (h.s.throwWall = h.s.throwMono = false), "wall+mono"],
    ["wall probe returns NaN", (h) => void (h.s.nanWall = true), (h) => void (h.s.nanWall = false), "wall"],
  ]

  describe.each(FAILURES)("%s", (_name, fail, recover, label) => {
    it.each([1, 5, 6, 7, 20])("on %i consecutive ticks, then recovery: no RUNTIME_GAP, nothing in the gap history, ONE marker without any duration", (k) => {
      const h = harness()
      const { tick } = h
      startRuntimeLiveness({ probes: h.probes })
      fail(h)
      for (let i = 0; i < k; i++) tick()
      expect(events("RUNTIME_GAP")).toEqual([])
      expect(events("RUNTIME_UNMEASURED")).toEqual([]) // nothing to say until a valid reading exists again
      expect(gapsInHistory()).toBe(0)
      recover(h)
      tick()
      expect(events("RUNTIME_GAP")).toEqual([])
      expect(gapsInHistory()).toBe(0) // recordGap was never called with a bound that was not read
      expect(events("RUNTIME_UNMEASURED")).toHaveLength(1)
      expect(events("RUNTIME_UNMEASURED")[0]).toMatchObject({ unmeasured_ticks: k, unreadable: label, expected_ms: LIVENESS_INTERVAL_MS })
      // The marker carries only these keys: in particular no gap_ms / span / duration of the unmeasured stretch.
      expect(Object.keys(events("RUNTIME_UNMEASURED")[0]!).sort()).toEqual(["event", "expected_ms", "instance", "ts", "unmeasured_ticks", "unreadable", "uptime_s"].sort())
      expect(diagnosticCounters().selfErrors).toBe(k) // one counted diagnostic failure per tick that could not be timed
      expect(vi.getTimerCount()).toBe(1)
      // …and the next ordinary ticks are silent again.
      for (let i = 0; i < 5; i++) tick()
      expect(sink.lines.filter((l) => l.payload.event !== "RUNTIME_START" && l.payload.event !== "RUNTIME_UNMEASURED")).toEqual([])
      expect(events("RUNTIME_UNMEASURED")).toHaveLength(1)
    })

    it("after recovery a REAL pause is measured from the recovery tick: exact gap, exact recorded bounds", () => {
      const h = harness()
      const { tick, pause } = h
      startRuntimeLiveness({ probes: h.probes })
      const id = beginPrismaOp("Product", "findMany") // lives through the unmeasured stretch and the later pause
      fail(h)
      for (let i = 0; i < 7; i++) tick()
      recover(h)
      tick() // recovery tick: references re-established here
      pause(300_000)
      tick(0) // the late tick
      expect(events("RUNTIME_GAP")).toHaveLength(1)
      expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 300_000, gap_mono_ms: 300_000, clock_skew_ms: 0, inflight_before: 1, inflight_now: 1 })
      expect(gapsInHistory()).toBe(1)
      endPrismaOp(id, true, p1017(), false)
      expect(events("OP_ERROR")[0]).toMatchObject({ gap_overlap_reported_ms: 300_000, tick_age_ms: 0 })
    })
  })

  it("recovery after ONE failure, then after SEVERAL, then a real pause: two markers (1 then 3), exactly one gap, and it is the real one", () => {
    const h = harness()
    const { tick, pause, s } = h
    startRuntimeLiveness({ probes: h.probes })
    s.throwWall = true
    tick()
    s.throwWall = false
    tick() // recovery after one failure
    tick()
    s.throwMono = true
    tick()
    tick()
    tick()
    s.throwMono = false
    tick() // recovery after three failures
    tick()
    pause(120_000)
    tick(0)
    expect(events("RUNTIME_UNMEASURED").map((m) => [m.unmeasured_ticks, m.unreadable])).toEqual([[1, "wall"], [3, "mono"]])
    expect(events("RUNTIME_GAP")).toHaveLength(1)
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 120_000 })
    expect(gapsInHistory()).toBe(1)
  })

  it("a stretch with two different failing probes is labelled with both", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    h.s.throwWall = true
    h.tick()
    h.s.throwWall = false
    h.s.throwMono = true
    h.tick()
    h.s.throwMono = false
    h.tick()
    expect(events("RUNTIME_UNMEASURED")[0]).toMatchObject({ unmeasured_ticks: 2, unreadable: "wall+mono" })
  })

  it("a pause hidden INSIDE an unmeasured stretch is flagged as unmeasured, never reported as a measured gap (stated limit)", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    h.tick()
    h.s.throwWall = true
    h.pause(300_000) // the process was paused…
    h.tick(0) // …and the late tick could not read the wall clock
    h.s.throwWall = false
    h.tick()
    expect(events("RUNTIME_GAP")).toEqual([])
    expect(gapsInHistory()).toBe(0)
    expect(events("RUNTIME_UNMEASURED")).toHaveLength(1)
    // The following pause is measured again, from the recovery tick.
    h.pause(60_000)
    h.tick(0)
    expect(events("RUNTIME_GAP").map((g) => g.gap_ms)).toEqual([60_000])
  })

  it("CPU consumed while unmeasured is not attributed to the next gap: the CPU references are re-established with the others", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    h.tick(LIVENESS_INTERVAL_MS, { proc: 1, main: 1 })
    h.s.throwMono = true
    for (let i = 0; i < 3; i++) h.tick(LIVENESS_INTERVAL_MS, { proc: 500, main: 400 })
    h.s.throwMono = false
    h.tick(LIVENESS_INTERVAL_MS, { proc: 500, main: 400 }) // recovery tick
    h.tick(60_000, { proc: 5, main: 4 })
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ gap_ms: 60_000, cpu_proc_ms: 5, cpu_main_ms: 4, cpu_other_ms: 1 })
  })

  it("the in-flight snapshot of a gap after recovery is the one taken at the recovery tick, not a stale one", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    const a = beginPrismaOp("Product", "findMany")
    h.tick()
    h.s.throwWall = true
    h.tick()
    endPrismaOp(a, false, undefined, false) // completes while unmeasured
    const b = beginPrismaOp("Store", "findMany") // starts while unmeasured
    h.s.throwWall = false
    h.tick() // recovery: snapshot now holds `b` only
    h.pause(120_000)
    h.tick(0)
    expect(events("RUNTIME_GAP")[0]).toMatchObject({ inflight_before: 1, ops_before: "Store.findMany:1" })
    endPrismaOp(b, false, undefined, false)
  })

  it("ticks that fire while the probes fail still count as ticks: tick_age_ms stays small and no gap overlap is invented for a slow operation", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    const id = beginPrismaOp("Product", "findMany")
    h.s.throwWall = true
    for (let i = 0; i < 7; i++) h.tick()
    endPrismaOp(id, false, undefined, false)
    expect(events("OP_SLOW")[0]).toMatchObject({ duration_ms: 7_000, gap_overlap_reported_ms: 0, tick_age_ms: 0 })
    expect(events("RUNTIME_GAP")).toEqual([])
  })

  it("a log sink that fails at the recovery tick loses the marker only: the references still advance, the next real pause is exact", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    h.s.throwWall = true
    for (let i = 0; i < 3; i++) h.tick()
    h.s.throwWall = false
    sink.throwOnLog = true
    h.tick()
    sink.throwOnLog = false
    h.tick()
    expect(events("RUNTIME_UNMEASURED")).toEqual([])
    expect(events("RUNTIME_GAP")).toEqual([])
    h.pause(60_000)
    h.tick(0)
    expect(events("RUNTIME_GAP").map((g) => g.gap_ms)).toEqual([60_000])
  })

  it("a probe that keeps failing for thousands of ticks keeps the state bounded and writes nothing; recovery counts them in one line", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    const linesBefore = sink.lines.length
    h.s.throwMono = true
    for (let i = 0; i < 3_000; i++) h.tick()
    expect(sink.lines.length).toBe(linesBefore)
    expect(vi.getTimerCount()).toBe(1)
    expect(__prismaDiagnosticsStateForTests().gaps).toBe(0)
    h.s.throwMono = false
    h.tick()
    expect(events("RUNTIME_UNMEASURED")[0]).toMatchObject({ unmeasured_ticks: 3_000, unreadable: "mono" })
  })

  it("starting with an unreadable clock does not start the heartbeat (no reference to measure from); it starts normally afterwards", () => {
    const h = harness()
    h.s.throwWall = true
    expect(startRuntimeLiveness({ probes: h.probes })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(sink.lines).toEqual([])
    expect(diagnosticCounters().selfErrors).toBe(1)
    h.s.throwWall = false
    expect(startRuntimeLiveness({ probes: h.probes })).not.toBeNull()
    expect(vi.getTimerCount()).toBe(1)
  })
})

describe("the diagnostic clock failing never turns a valid in-flight snapshot into an empty one", () => {
  it("the last tick before a real pause could not read ages: the gap still reports how many operations and which ones were in flight", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    beginPrismaOp("Product", "findMany")
    beginPrismaOp("Store", "findMany")
    h.tick() // ordinary tick
    h.s.diagClockDown = true
    h.tick() // the heartbeat's probes are fine, the diagnostic clock is not: ages unknown, registry intact
    h.s.diagClockDown = false
    h.pause(300_000)
    h.tick(0)
    const gap = events("RUNTIME_GAP")[0]!
    expect(gap).toMatchObject({ gap_ms: 300_000, inflight_before: 2, ops_before: "Product.findMany:1,Store.findMany:1", inflight_now: 2 })
    expect("oldest_before_ms" in gap).toBe(false) // unknown, therefore absent — not 0
  })

  it("tick_age_ms is omitted (stamp cleared) after a tick whose stamp could not be taken, instead of growing from an old stamp", () => {
    const h = harness()
    startRuntimeLiveness({ probes: h.probes })
    h.tick()
    h.s.diagClockDown = true
    h.tick()
    h.s.diagClockDown = false
    const id = beginPrismaOp("Product", "findMany")
    h.pause(6_000) // no tick since the failed stamp
    endPrismaOp(id, false, undefined, false)
    expect("tick_age_ms" in events("OP_SLOW")[0]!).toBe(false)
    h.tick(0) // the next tick stamps again
    const next = beginPrismaOp("Product", "findMany")
    h.pause(5_500)
    endPrismaOp(next, false, undefined, false)
    expect(events("OP_SLOW")[1]).toMatchObject({ tick_age_ms: 5_500 })
  })
})

describe("what is logged", () => {
  it("only documented keys, no free text", () => {
    vi.stubEnv("VERCEL_REGION", "iad1")
    const { probes, tick } = harness()
    startRuntimeLiveness({ probes })
    beginPrismaOp("Store", "findMany")
    tick(LIVENESS_INTERVAL_MS)
    tick(300_000, { proc: 1, main: 1 })
    const allowed = new Set([
      "event", "ts", "instance", "uptime_s", "suppressed",
      "node", "thread_cpu", "region", "interval_ms", "gap_report_ms",
      "gap_ms", "gap_mono_ms", "clock_skew_ms", "expected_ms", "cpu_proc_ms", "cpu_main_ms", "cpu_other_ms",
      "inflight_before", "oldest_before_ms", "ops_before", "inflight_now", "expired", "dropped",
      "wall_delta_ms", "mono_delta_ms",
    ])
    expect(sink.lines.length).toBeGreaterThanOrEqual(2)
    for (const line of sink.lines) {
      expect(line.module).toBe("prisma_diag")
      for (const key of Object.keys(line.payload)) expect(allowed.has(key), key).toBe(true)
    }
  })
})

describe("source contract", () => {
  const raw = readFileSync("lib/runtime-liveness.ts", "utf8")
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  it("is server-only, unref's its timer, and does no post-response or awaited work", () => {
    expect(raw.startsWith('import "server-only"')).toBe(true)
    expect(code).toMatch(/timer\.unref\(\)/)
    expect(code).not.toMatch(/\bawait\b|\basync\b|setTimeout|setImmediate|queueMicrotask|new Promise/)
    expect(code).not.toMatch(/\bafter\(|waitUntil|from "next\/server"/)
    expect(code.match(/setInterval\(/g)).toHaveLength(1)
  })

  it("does not import Prisma or the network", () => {
    expect(code).not.toMatch(/@prisma\/client|@\/lib\/prisma"|fetch\(|node:http|node:net/)
  })
})
