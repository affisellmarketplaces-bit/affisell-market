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

import { clearPrismaCircuit, notePrismaUnreachable } from "@/lib/prisma-circuit-breaker"
import {
  INFLIGHT_EXPIRE_MS,
  MAX_GAP_HISTORY,
  MAX_INFLIGHT_OPS,
  MAX_LOGS_PER_MINUTE,
  SLOW_OP_MS,
  __prismaDiagnosticsStateForTests,
  __resetPrismaDiagnosticsForTests,
  __setPrismaDiagnosticsClockForTests,
  __setPrismaDiagnosticsEnabledForTests,
  beginPrismaOp,
  classifyPrismaFailure,
  countPrismaAttempt,
  diagnosticCounters,
  emitDiag,
  endPrismaOp,
  gapOverlapMs,
  noteClientCreated,
  noteHeartbeatStopped,
  noteHeartbeatTick,
  operationKey,
  recordGap,
  safeToken,
  snapshotInflight,
} from "@/lib/prisma-diagnostics"
import { RUNTIME_INSTANCE_ID } from "@/lib/runtime-instance"

let wall = 1_800_000_000_000
let mono = 10_000
const advance = (ms: number) => {
  wall += ms
  mono += ms
}
const lines = () => sink.lines.map((l) => l.payload)
const events = (name: string) => lines().filter((p) => p.event === name)

const connErr = (code: string, message = "connection problem") => Object.assign(new Error(message), { code })

beforeEach(() => {
  sink.lines.length = 0
  sink.throwOnLog = false
  wall = 1_800_000_000_000
  mono = 10_000
  __resetPrismaDiagnosticsForTests()
  __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => mono })
  __setPrismaDiagnosticsEnabledForTests(true)
  clearPrismaCircuit()
})

afterEach(() => {
  __resetPrismaDiagnosticsForTests()
  clearPrismaCircuit()
})

describe("activation", () => {
  it("is OFF by default under test (NODE_ENV is not production): nothing is registered, nothing is logged", () => {
    __setPrismaDiagnosticsEnabledForTests(null)
    expect(beginPrismaOp("Product", "findMany")).toBe(0)
    endPrismaOp(0, true, connErr("P1017"), false)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
    expect(sink.lines).toEqual([])
  })

  it("can be forced off even when otherwise enabled", () => {
    __setPrismaDiagnosticsEnabledForTests(false)
    expect(beginPrismaOp("Product", "findMany")).toBe(0)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
  })
})

describe("registry cleanup", () => {
  it("success: the entry is gone and a fast success is not logged", () => {
    const id = beginPrismaOp("Product", "findMany")
    expect(id).toBeGreaterThan(0)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(1)
    advance(40)
    endPrismaOp(id, false, undefined, false)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
    expect(sink.lines).toEqual([])
  })

  it("rejection: the entry is gone and a connection-class failure is logged", () => {
    const id = beginPrismaOp("AffiliateProduct", "findMany")
    countPrismaAttempt(id)
    countPrismaAttempt(id)
    advance(120)
    endPrismaOp(id, true, connErr("P1017", "Server has closed the connection."), false)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
    expect(events("OP_ERROR")).toHaveLength(1)
    expect(events("OP_ERROR")[0]).toMatchObject({
      instance: RUNTIME_INSTANCE_ID,
      op: "AffiliateProduct.findMany",
      outcome: "error",
      error_class: "unreachable",
      error_code: "P1017",
      attempts: 2,
      duration_ms: 120,
    })
  })

  it.each([
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 0],
    ["a plain object", { reason: "x" }],
    ["an object whose getters throw", { get code(): string { throw new Error("getter") }, get message(): string { throw new Error("getter") } }],
  ])("non-standard rejection (%s): never throws out of endPrismaOp, entry removed", (_name, thrown) => {
    const id = beginPrismaOp("User", "findUnique")
    expect(() => endPrismaOp(id, true, thrown, false)).not.toThrow()
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
  })

  it("ending an id twice, or an unknown id, is harmless", () => {
    const id = beginPrismaOp("User", "findFirst")
    endPrismaOp(id, false, undefined, false)
    expect(() => endPrismaOp(id, false, undefined, false)).not.toThrow()
    expect(() => endPrismaOp(999_999, true, new Error("x"), false)).not.toThrow()
    expect(() => countPrismaAttempt(999_999)).not.toThrow()
  })

  it("a large number of cycles (success and failure) leaves the registry empty and logs only within the rate limit", () => {
    for (let i = 0; i < 100_000; i++) {
      const id = beginPrismaOp("Product", "findMany")
      countPrismaAttempt(id)
      if (i % 100 === 0) endPrismaOp(id, true, connErr("P2024"), false)
      else endPrismaOp(id, false, undefined, false)
    }
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
    expect(diagnosticCounters().dropped).toBe(0)
    expect(events("OP_ERROR")).toHaveLength(MAX_LOGS_PER_MINUTE) // 1 000 failures inside one minute → capped
  })
})

describe("bounds", () => {
  it("a full registry degrades the collection (dropped counter, id 0), never the caller; slots free up when operations end", () => {
    const ids: number[] = []
    for (let i = 0; i < MAX_INFLIGHT_OPS; i++) ids.push(beginPrismaOp("Product", "findMany"))
    expect(ids.every((id) => id > 0)).toBe(true)
    expect(beginPrismaOp("Product", "findMany")).toBe(0)
    expect(beginPrismaOp("Product", "findMany")).toBe(0)
    expect(diagnosticCounters().dropped).toBe(2)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(MAX_INFLIGHT_OPS)

    endPrismaOp(ids[0]!, false, undefined, false)
    expect(beginPrismaOp("Product", "findMany")).toBeGreaterThan(0)
    endPrismaOp(0, true, new Error("dropped op"), false) // id 0 = nothing registered: ignored
  })

  it("entries older than 15 minutes are swept (counted as expired) and ending them later is a no-op", () => {
    const stale = beginPrismaOp("Product", "findMany")
    advance(INFLIGHT_EXPIRE_MS + 1)
    const fresh = beginPrismaOp("User", "findMany")
    const snap = snapshotInflight()
    expect(snap.count).toBe(1)
    expect(diagnosticCounters().expired).toBe(1)
    expect(() => endPrismaOp(stale, true, connErr("P1017"), false)).not.toThrow()
    expect(sink.lines).toEqual([])
    endPrismaOp(fresh, false, undefined, false)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
  })

  it("the gap history keeps the last 8 gaps", () => {
    for (let i = 0; i < 25; i++) recordGap(i * 100, i * 100 + 50)
    expect(__prismaDiagnosticsStateForTests().gaps).toBe(MAX_GAP_HISTORY)
  })

  it("the rate-limit table stays bounded even for unexpected event names", () => {
    for (let i = 0; i < 200; i++) emitDiag(`UNEXPECTED_${i}`, { n: i })
    expect(__prismaDiagnosticsStateForTests().rateSlots).toBeLessThanOrEqual(16)
  })
})

describe("snapshot and gap overlap", () => {
  it("reports count, oldest age and the four most frequent operations", () => {
    for (let i = 0; i < 3; i++) beginPrismaOp("AffiliateProduct", "findMany")
    advance(500)
    for (let i = 0; i < 2; i++) beginPrismaOp("Store", "findMany")
    beginPrismaOp("", "$queryRaw")
    advance(250)
    const snap = snapshotInflight()
    expect(snap.count).toBe(6)
    expect(snap.oldestAgeMs).toBe(750)
    expect(snap.ops).toBe("AffiliateProduct.findMany:3,Store.findMany:2,$queryRaw:1")
    expect(snap.ops.length).toBeLessThanOrEqual(120)
  })

  it("gapOverlapMs sums partial and full overlaps and ignores disjoint gaps", () => {
    recordGap(1_000, 2_000)
    recordGap(5_000, 9_000)
    recordGap(20_000, 21_000)
    expect(gapOverlapMs(1_500, 6_000)).toBe(500 + 1_000)
    expect(gapOverlapMs(0, 100_000)).toBe(1_000 + 4_000 + 1_000)
    expect(gapOverlapMs(30_000, 40_000)).toBe(0)
  })

  it("an operation whose life overlaps a gap is logged as OP_SLOW once it lasted a second, with the overlap", () => {
    const start = wall
    const id = beginPrismaOp("Product", "findMany")
    recordGap(start + 100, start + 1_900)
    advance(2_000)
    endPrismaOp(id, false, undefined, false)
    expect(events("OP_SLOW")).toHaveLength(1)
    expect(events("OP_SLOW")[0]).toMatchObject({ op: "Product.findMany", outcome: "ok", gap_overlap_reported_ms: 1_800, duration_ms: 2_000 })
  })
})

describe("tick age — the second measure next to the gaps already reported (E1)", () => {
  const slowFailure = (id: number) => endPrismaOp(id, true, connErr("P1017"), false)

  it("is omitted while no heartbeat has ticked: nothing is claimed about the loop", () => {
    const id = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    slowFailure(id)
    const line = events("OP_ERROR")[0]!
    expect("tick_age_ms" in line).toBe(false)
    expect(line.gap_overlap_reported_ms).toBe(0)
  })

  it("is the time since the last tick, on the monotonic clock, measured when the operation ends", () => {
    noteHeartbeatTick()
    const id = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS + 250)
    slowFailure(id)
    expect(events("OP_ERROR")[0]).toMatchObject({ duration_ms: SLOW_OP_MS + 250, tick_age_ms: SLOW_OP_MS + 250 })
    noteHeartbeatTick()
    const next = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    slowFailure(next)
    expect(events("OP_ERROR")[1]).toMatchObject({ tick_age_ms: SLOW_OP_MS })
  })

  it("an operation that ends BEFORE the late tick reports 0 reported overlap AND a large tick age; the same pause seen after the tick reports both", () => {
    noteHeartbeatTick()
    const start = wall
    const before = beginPrismaOp("Product", "findMany")
    const after = beginPrismaOp("Store", "findMany")
    advance(300_000) // the pause: no tick
    slowFailure(before)
    // the late tick: stamps itself, then records the gap
    noteHeartbeatTick()
    recordGap(start, wall)
    slowFailure(after)

    const [first, second] = events("OP_ERROR") as [Record<string, unknown>, Record<string, unknown>]
    expect(first).toMatchObject({ op: "Product.findMany", gap_overlap_reported_ms: 0, tick_age_ms: 300_000 })
    expect(second).toMatchObject({ op: "Store.findMany", gap_overlap_reported_ms: 300_000, tick_age_ms: 0 })
  })

  it("never negative, even if the monotonic clock reads lower than the stamp", () => {
    noteHeartbeatTick()
    const id = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    mono -= SLOW_OP_MS + 5_000 // a clock that goes backward (should not happen; must not produce a negative figure)
    slowFailure(id)
    expect(Number(events("OP_ERROR")[0]!.tick_age_ms)).toBeGreaterThanOrEqual(0)
  })

  it("stopping the heartbeat removes it again", () => {
    noteHeartbeatTick()
    noteHeartbeatStopped()
    const id = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    slowFailure(id)
    expect("tick_age_ms" in events("OP_ERROR")[0]!).toBe(false)
  })

  it("a failing clock in noteHeartbeatTick is swallowed and counted", () => {
    __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => { throw new Error("clock") } })
    expect(() => noteHeartbeatTick()).not.toThrow()
    expect(diagnosticCounters().selfErrors).toBe(1)
  })

  it("the old field name `gap_overlap_ms` (which read as a verdict) is gone from every line", () => {
    noteHeartbeatTick()
    const id = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    slowFailure(id)
    expect("gap_overlap_ms" in events("OP_ERROR")[0]!).toBe(false)
    expect(readFileSync("lib/prisma-diagnostics.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")).not.toMatch(/gap_overlap_ms/)
  })

  it("a stamp that cannot be taken CLEARS the previous one (tick_age_ms is then omitted, not grown from an old stamp)", () => {
    noteHeartbeatTick() // valid stamp
    __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => { throw new Error("clock") } })
    noteHeartbeatTick()
    __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => mono })
    const id = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    slowFailure(id)
    expect("tick_age_ms" in events("OP_ERROR")[0]!).toBe(false)
    expect(diagnosticCounters().selfErrors).toBe(1)
  })

  it("a non-finite clock reading never becomes a stamp", () => {
    noteHeartbeatTick()
    __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => Number.NaN })
    noteHeartbeatTick()
    __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => mono })
    const id = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    slowFailure(id)
    expect("tick_age_ms" in events("OP_ERROR")[0]!).toBe(false)
  })
})

describe("in-flight snapshot when the diagnostic clock fails", () => {
  const unreadable = (): void => __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => { throw new Error("clock") } })

  it("keeps the count and the operation names from the registry, reports the age as unknown (null), never as 0", () => {
    beginPrismaOp("Product", "findMany")
    beginPrismaOp("Product", "findMany")
    beginPrismaOp("Store", "findMany")
    advance(500)
    unreadable()
    const snap = snapshotInflight()
    expect(snap).toEqual({ count: 3, oldestAgeMs: null, ops: "Product.findMany:2,Store.findMany:1" })
    expect(diagnosticCounters().selfErrors).toBe(1)
  })

  it("does not sweep entries while ages are unknown, and does not lose them", () => {
    beginPrismaOp("Product", "findMany")
    advance(INFLIGHT_EXPIRE_MS + 1) // would be expired…
    unreadable()
    expect(snapshotInflight().count).toBe(1) // …but ages cannot be computed: nothing is removed on a guess
    expect(diagnosticCounters().expired).toBe(0)
    __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => mono })
    expect(snapshotInflight()).toMatchObject({ count: 0, oldestAgeMs: 0 }) // swept as soon as ages are readable again
    expect(diagnosticCounters().expired).toBe(1)
  })

  it("a non-finite reading is treated like a failed one", () => {
    beginPrismaOp("Store", "findMany")
    __setPrismaDiagnosticsClockForTests({ wall: () => wall, mono: () => Number.NaN })
    expect(snapshotInflight()).toEqual({ count: 1, oldestAgeMs: null, ops: "Store.findMany:1" })
  })

  it("with a readable clock the result is unchanged (count, oldest age, names)", () => {
    beginPrismaOp("Store", "findMany")
    advance(250)
    expect(snapshotInflight()).toEqual({ count: 1, oldestAgeMs: 250, ops: "Store.findMany:1" })
  })
})

describe("recordGap only accepts bounds that were read", () => {
  it.each([
    ["NaN start", Number.NaN, 10],
    ["NaN end", 10, Number.NaN],
    ["infinite end", 10, Number.POSITIVE_INFINITY],
    ["end equal to start", 10, 10],
    ["end before start", 10, 5],
  ])("refuses %s", (_name, start, end) => {
    recordGap(start, end)
    expect(__prismaDiagnosticsStateForTests().gaps).toBe(0)
    expect(gapOverlapMs(0, 100)).toBe(0)
  })

  it("still records an ordinary gap", () => {
    recordGap(1_000, 2_000)
    expect(__prismaDiagnosticsStateForTests().gaps).toBe(1)
  })
})

describe("what is logged", () => {
  it("logs an operation of SLOW_OP_MS or more even when it succeeded; not one just below", () => {
    const fast = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS - 1)
    endPrismaOp(fast, false, undefined, false)
    const slow = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    endPrismaOp(slow, false, undefined, false)
    expect(events("OP_SLOW")).toHaveLength(1)
  })

  it.each([
    ["P2024", connErr("P2024", "Timed out fetching a new connection"), "pool_timeout", true],
    ["P1001", connErr("P1001", "Can't reach database server"), "unreachable", true],
    ["P1002", connErr("P1002"), "unreachable", true],
    ["P1017", connErr("P1017"), "unreachable", true],
    ["engine not ready", new Error("Engine was empty"), "engine_not_ready", true],
    ["reset by peer", new Error("read ECONNRESET: connection reset by peer"), "closed", true],
    ["P2002 (business)", connErr("P2002", "Unique constraint failed"), "other_prisma", false],
    ["a plain Error", new Error("anything"), "other", false],
    ["circuit-open rejection", new Error("Database temporarily unreachable — retry in a few seconds."), "other", false],
  ])("classifies %s as %s and logs it only if connection-class (%s)", (_name, error, cls, logged) => {
    expect(classifyPrismaFailure(error)).toBe(cls)
    const id = beginPrismaOp("User", "findFirst")
    advance(10)
    endPrismaOp(id, true, error, false)
    expect(events("OP_ERROR")).toHaveLength(logged ? 1 : 0)
  })

  it("records the circuit state at start and end (`circuit_opened_during`: closed at start, open at the end — not proof that THIS operation opened it)", () => {
    const id = beginPrismaOp("Product", "findMany")
    notePrismaUnreachable(connErr("P1017")) // what executeWithReconnectCore does on the way out
    endPrismaOp(id, true, connErr("P1017"), false)
    expect(events("OP_ERROR")[0]).toMatchObject({ circuit_at_start: false, circuit_at_end: true, circuit_opened_during: true })
  })

  it("records the client generation at start and at the end (a reset in between is visible)", () => {
    noteClientCreated("default")
    const id = beginPrismaOp("Product", "findMany")
    noteClientCreated("default")
    endPrismaOp(id, true, connErr("P1017"), false)
    expect(events("CLIENT_CREATED").map((e) => e.generation)).toEqual([1, 2])
    expect(events("OP_ERROR")[0]).toMatchObject({ client_gen_start: 1, client_gen_now: 2 })
    noteClientCreated("fulfillment")
    expect(__prismaDiagnosticsStateForTests().generation).toEqual({ default: 2, fulfillment: 1 })
  })

  it("does not announce client creations when diagnostics are off, but still counts the generation", () => {
    __setPrismaDiagnosticsEnabledForTests(false)
    noteClientCreated("default")
    expect(sink.lines).toEqual([])
    expect(__prismaDiagnosticsStateForTests().generation.default).toBe(1)
  })
})

describe("no sensitive data in the logs", () => {
  it("hostile error text, names and operation names never reach a log line", () => {
    const hostile = Object.assign(
      new Error(
        `SELECT "email" FROM "User" WHERE email = 'alice@example.com' via postgresql://user:s3cret@ep-x.neon.tech/db and https://cdn.example/photos/p.jpg for Secret Product Name`
      ),
      { code: "P1017", name: "Weird name with spaces https://evil.example/x?token=abc" }
    )
    const id = beginPrismaOp("Product; DROP TABLE x", "find Many")
    advance(5)
    endPrismaOp(id, true, hostile, false)
    const text = JSON.stringify(sink.lines)
    expect(text).not.toMatch(/alice|example\.com|s3cret|postgresql|https?:|cdn\.|photos|Secret Product|SELECT|"User"|token|abc|neon\.tech|\//)
    const payload = events("OP_ERROR")[0]!
    expect(payload.op).toBe("unknown.unknown") // neither part looks like a Prisma identifier
    expect(payload.error_name).toBe("other") // a name outside the closed list is never copied
    expect(payload.error_code).toBe("P1017")
  })

  it("only identifier-shaped model and operation names are kept; known error classes are named, others are not", () => {
    expect(operationKey("AffiliateProduct", "findMany")).toBe("AffiliateProduct.findMany")
    expect(operationKey("", "$queryRaw")).toBe("$queryRaw")
    expect(operationKey("", "$executeRaw")).toBe("$executeRaw")
    expect(operationKey("product", "findMany")).toBe("unknown.findMany") // models are PascalCase in this schema
    expect(operationKey("Product", "find Many; --")).toBe("Product.unknown")
    expect(operationKey("P".repeat(80), "findMany")).toBe("unknown.findMany")
    for (const [name, expected] of [
      ["PrismaClientKnownRequestError", "PrismaClientKnownRequestError"],
      ["PrismaClientInitializationError", "PrismaClientInitializationError"],
      ["Error", "Error"],
      ["BuildPhaseWriteBlockedError", "other"],
      ["alice@example.com", "other"],
    ] as const) {
      const id = beginPrismaOp("User", "findMany")
      endPrismaOp(id, true, Object.assign(new Error("x"), { name, code: "P1017" }), false)
      expect(events("OP_ERROR").pop()?.error_name).toBe(expected)
    }
    const id = beginPrismaOp("User", "findMany")
    endPrismaOp(id, true, "just a string", false)
    endPrismaOp(beginPrismaOp("User", "findMany"), true, { code: "P1017" }, false)
    expect(events("OP_ERROR").pop()?.error_name).toBe("object")
  })

  it("an error code that is not a Prisma code is not copied", () => {
    const id = beginPrismaOp("User", "findMany")
    endPrismaOp(id, true, Object.assign(new Error("closed"), { code: "ECONNRESET: postgresql://u:p@h/db" }), false)
    expect(JSON.stringify(sink.lines)).not.toMatch(/postgresql|ECONNRESET|u:p@/)
  })

  it("every key of every line belongs to the documented list", () => {
    const allowed = new Set([
      "event", "ts", "instance", "uptime_s", "suppressed",
      "op", "outcome", "duration_ms", "attempts", "error_class", "error_code", "error_name",
      "circuit_at_start", "circuit_at_end", "circuit_opened_during", "client_gen_start", "client_gen_now", "gap_overlap_reported_ms", "tick_age_ms", "inflight_now",
      "kind", "generation",
    ])
    noteClientCreated("default")
    const a = beginPrismaOp("Product", "findMany")
    advance(SLOW_OP_MS)
    endPrismaOp(a, false, undefined, false)
    const b = beginPrismaOp("", "$queryRaw")
    endPrismaOp(b, true, connErr("P2024"), true)
    expect(sink.lines.length).toBeGreaterThanOrEqual(3)
    for (const line of sink.lines) {
      expect(line.module).toBe("prisma_diag")
      for (const key of Object.keys(line.payload)) expect(allowed.has(key), key).toBe(true)
    }
  })

  it("safeToken keeps a closed alphabet and a maximum length", () => {
    expect(safeToken("Product.findMany")).toBe("Product.findMany")
    expect(safeToken("$queryRaw")).toBe("$queryRaw")
    expect(safeToken("a b/c:d?e=f")).toBe("a_b_c_d_e_f")
    expect(safeToken("x".repeat(500)).length).toBe(48)
  })
})

describe("rate limit", () => {
  it("caps each event type per minute and reports how many lines were held back on the next allowed line", () => {
    const fail = () => {
      const id = beginPrismaOp("Product", "findMany")
      endPrismaOp(id, true, connErr("P1017"), false)
    }
    for (let i = 0; i < 50; i++) fail()
    expect(events("OP_ERROR")).toHaveLength(MAX_LOGS_PER_MINUTE)
    advance(60_000)
    fail()
    const resumed = events("OP_ERROR")
    expect(resumed).toHaveLength(MAX_LOGS_PER_MINUTE + 1)
    expect(resumed[resumed.length - 1]!.suppressed).toBe(30)
  })

  it("event types are limited independently", () => {
    for (let i = 0; i < 30; i++) emitDiag("A", { n: i })
    for (let i = 0; i < 30; i++) emitDiag("B", { n: i })
    expect(events("A")).toHaveLength(MAX_LOGS_PER_MINUTE)
    expect(events("B")).toHaveLength(MAX_LOGS_PER_MINUTE)
  })
})

describe("a diagnostic failure never escapes", () => {
  it("a throwing clock: begin returns 0, end does not throw, the failure is counted", () => {
    __setPrismaDiagnosticsClockForTests({
      wall: () => {
        throw new Error("clock")
      },
      mono: () => {
        throw new Error("clock")
      },
    })
    expect(beginPrismaOp("Product", "findMany")).toBe(0)
    expect(() => endPrismaOp(1, true, connErr("P1017"), false)).not.toThrow()
    expect(() => snapshotInflight()).not.toThrow()
    expect(() => emitDiag("X", {})).not.toThrow()
    expect(diagnosticCounters().selfErrors).toBeGreaterThan(0)
  })

  it("a log sink that throws is swallowed; the registry is still cleaned", () => {
    const id = beginPrismaOp("Product", "findMany")
    sink.throwOnLog = true
    expect(() => endPrismaOp(id, true, connErr("P1017"), false)).not.toThrow()
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
    expect(diagnosticCounters().selfErrors).toBe(1)
  })
})

describe("source contract", () => {
  const code = readFileSync("lib/prisma-diagnostics.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")

  it("is server-only and does no asynchronous work of its own", () => {
    expect(readFileSync("lib/prisma-diagnostics.ts", "utf8").startsWith('import "server-only"')).toBe(true)
    expect(code).not.toMatch(/\bawait\b|\basync\b|setTimeout|setInterval|setImmediate|queueMicrotask|\.then\(|new Promise/)
    expect(code).not.toMatch(/\bafter\(|waitUntil|from "next\/server"/)
  })

  it("never reads an error message, an argument or a result", () => {
    expect(code).not.toMatch(/\.message\b/)
    expect(code).not.toMatch(/JSON\.stringify|\.stack\b/)
  })
})
