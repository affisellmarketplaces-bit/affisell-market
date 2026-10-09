import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * CHARACTERISATION of the REAL reconnect extension of lib/prisma.ts (`executeWithReconnect`).
 *
 * The older test (prisma-reconnect-query.test.ts) re-implements the retry loop locally and therefore proves nothing about the shipped
 * code. Here `@prisma/client` is replaced by a fake class that only RECORDS the configuration handed to `$extends`; the real
 * `lib/prisma.ts` builds its client, and the real extension callbacks (`$allModels.$allOperations`, `$queryRaw`, `$executeRaw`) are invoked
 * with a mocked `ctx.query`. No database, no network, no timer wait: retry delays run on fake timers.
 *
 * These expectations pin what the code does TODAY (attempt counts, delays, thrown objects, circuit, log lines). They were written and run
 * on the unmodified code first (22 tests green, then 9 mutations of lib/prisma.ts all detected). The diagnostic wrapper added afterwards must
 * leave every one of them true, so the SAME scenarios now run twice: with the diagnostics OFF and ON. Assertions were not changed.
 */

vi.mock("server-only", () => ({}))

type ExtensionConfig = {
  name?: string
  query: {
    $allModels?: { $allOperations: (ctx: Ctx) => Promise<unknown> }
    $allOperations?: (ctx: Ctx) => Promise<unknown>
    $queryRaw?: (ctx: Ctx) => Promise<unknown>
    $executeRaw?: (ctx: Ctx) => Promise<unknown>
  }
}
type Ctx = { model?: string; operation?: string; args: unknown; query: (a: unknown) => Promise<unknown> }

const fake = vi.hoisted(() => ({ configs: [] as unknown[], constructed: 0 }))
vi.mock("@prisma/client", () => {
  class PrismaClient {
    constructor() {
      fake.constructed += 1
    }
    $on() {}
    $extends(config: unknown) {
      fake.configs.push(config)
      // `withBuildWriteGuard(extended)` calls `$extends` again on whatever this returns.
      return {
        $extends: (second: unknown) => {
          fake.configs.push(second)
          return { __guarded: true }
        },
      }
    }
  }
  return { PrismaClient, Prisma: { sql: (...a: unknown[]) => a } }
})

import { clearPrismaCircuit, isPrismaCircuitOpen } from "@/lib/prisma-circuit-breaker"
import {
  __prismaDiagnosticsStateForTests,
  __resetPrismaDiagnosticsForTests,
  __setPrismaDiagnosticsClockForTests,
  __setPrismaDiagnosticsEnabledForTests,
  noteHeartbeatTick,
} from "@/lib/prisma-diagnostics"

let reconnect: ExtensionConfig
let guard: ExtensionConfig
let consoleLog: ReturnType<typeof vi.spyOn>
let warn: ReturnType<typeof vi.spyOn>
let testIndex = 0

const allOps = (ctx: Ctx) => reconnect.query.$allModels!.$allOperations(ctx)
const settle = <T,>(p: Promise<T>) => p.then((value) => ({ value }), (error: unknown) => ({ error }))
const warnLines = () => warn.mock.calls.map((c) => String(c[0]))

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://user:pw@ep-test-pooler.c-3.eu-central-1.aws.neon.tech/db?sslmode=require")
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
  const { prisma } = await import("@/lib/prisma")
  void (prisma as unknown as Record<string, unknown>).$disconnect // touching the lazy proxy creates the singleton client
  reconnect = (fake.configs as ExtensionConfig[]).find((c) => c.name === "affisell-reconnect")!
  guard = (fake.configs as ExtensionConfig[]).find((c) => c.name === "affisell-build-write-guard")!
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 9, 12, 0, 0) + ++testIndex * 120_000)) // > circuit cooldown and warn throttle apart
  clearPrismaCircuit()
  warn = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  clearPrismaCircuit()
  vi.useRealTimers()
  warn.mockRestore()
})

const p1017 = () => Object.assign(new Error("Server has closed the connection."), { code: "P1017" })
const p2024 = (n: number) => Object.assign(new Error(`Timed out fetching a new connection from the connection pool #${n}`), { code: "P2024" })

describe("wiring of the real client", () => {
  it("builds the reconnect extension first and the build-write guard last (outermost), once", () => {
    expect(fake.constructed).toBe(1)
    expect(fake.configs).toHaveLength(2)
    expect((fake.configs as ExtensionConfig[]).map((c) => c.name)).toEqual(["affisell-reconnect", "affisell-build-write-guard"])
    expect(reconnect.query.$allModels?.$allOperations).toBeTypeOf("function")
    expect(reconnect.query.$queryRaw).toBeTypeOf("function")
    expect(reconnect.query.$executeRaw).toBeTypeOf("function")
    expect(guard.query.$allOperations).toBeTypeOf("function")
  })

  it("logs the client creation exactly as before (host, pooler flag, client label)", () => {
    const line = consoleLog.mock.calls.find((c) => c[0] === "[prisma]")
    expect(line?.[1]).toEqual({ result: "client_created", host: "ep-test-pooler.c-3.eu-central-1.aws.neon.tech", pooler: true, client: "default" })
  })
})

const MODES = [
  ["diagnostics OFF", false],
  ["diagnostics ON", true],
] as const

describe.each(MODES)("%s", (_label, diagnosticsOn) => {
  beforeEach(() => {
    __resetPrismaDiagnosticsForTests()
    __setPrismaDiagnosticsEnabledForTests(diagnosticsOn)
  })

  afterEach(() => {
    // Whatever the scenario did (success, rejection, odd rejection value), nothing may stay registered.
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
    __setPrismaDiagnosticsEnabledForTests(null)
  })

  describe("success path", () => {
    it("calls query once with the SAME args object and returns the SAME result object", async () => {
      const args = { where: { id: "x" } }
      const result = { id: "x", rows: [1, 2, 3] }
      const query = vi.fn(async (_args: unknown) => result)

      const out = await allOps({ model: "Product", operation: "findMany", args, query })

      expect(out).toBe(result)
      expect(query).toHaveBeenCalledTimes(1)
      expect(query.mock.calls[0]![0]).toBe(args)
      expect(warnLines()).toEqual([])
      expect(isPrismaCircuitOpen()).toBe(false)
    })

    it("$queryRaw and $executeRaw entry points go through the same logic (args passed through, result returned as is)", async () => {
      const rawArgs = [["SELECT ", ""], 1]
      const rows = [{ a: 1 }]
      const queryRaw = vi.fn(async (_args: unknown) => rows)
      const executeRaw = vi.fn(async (_args: unknown) => 7)

      expect(await reconnect.query.$queryRaw!({ args: rawArgs, query: queryRaw })).toBe(rows)
      expect(await reconnect.query.$executeRaw!({ args: rawArgs, query: executeRaw })).toBe(7)
      expect(queryRaw.mock.calls[0]![0]).toBe(rawArgs)
      expect(executeRaw.mock.calls[0]![0]).toBe(rawArgs)
    })

    it("an undefined/null/falsy successful result is returned unchanged", async () => {
      for (const value of [undefined, null, 0, ""]) {
        expect(await allOps({ model: "M", operation: "findFirst", args: {}, query: async () => value })).toBe(value)
      }
    })
  })

  describe("P1017 (server closed the connection): no retry, circuit opens", () => {
    it("one attempt, the same error object, circuit open, one 'unreachable' warning and no retry line", async () => {
      const error = p1017()
      const query = vi.fn(async () => {
        throw error
      })

      const out = await settle(allOps({ model: "Product", operation: "findMany", args: { a: 1 }, query }))

      expect(out).toEqual({ error })
      expect((out as { error: unknown }).error).toBe(error)
      expect(query).toHaveBeenCalledTimes(1)
      expect(isPrismaCircuitOpen()).toBe(true)
      expect(warnLines().filter((l) => /database unreachable/.test(l))).toHaveLength(1)
      expect(warnLines().filter((l) => /retry \d\/2/.test(l))).toHaveLength(0)
    })

    it("while the circuit is open the query is NOT called and a plain Error is thrown; after 8 s it runs again", async () => {
      const first = vi.fn(async () => {
        throw p1017()
      })
      await settle(allOps({ model: "Product", operation: "findMany", args: {}, query: first }))
      expect(isPrismaCircuitOpen()).toBe(true)

      const blocked = vi.fn(async () => "never")
      const out = await settle(allOps({ model: "Product", operation: "findMany", args: {}, query: blocked }))
      expect((out as { error: Error }).error).toBeInstanceOf(Error)
      expect((out as { error: Error }).error.message).toBe("Database temporarily unreachable — retry in a few seconds.")
      expect(blocked).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(8_001)
      const again = vi.fn(async () => "ok")
      expect(await allOps({ model: "Product", operation: "findMany", args: {}, query: again })).toBe("ok")
      expect(again).toHaveBeenCalledTimes(1)
      expect(isPrismaCircuitOpen()).toBe(false)
    })
  })

  describe("P2024 (pool starved): two retries with 150 ms then 600 ms, never opens the circuit", () => {
    it("three attempts at t=0, 150, 750 ms; rejects with the LAST error object; logs both retry lines", async () => {
      const errors = [p2024(1), p2024(2), p2024(3)]
      const times: number[] = []
      const t0 = Date.now()
      const query = vi.fn(async () => {
        times.push(Date.now() - t0)
        throw errors[times.length - 1]
      })

      const pending = settle(allOps({ model: "Product", operation: "findMany", args: { q: 1 }, query }))
      await vi.advanceTimersByTimeAsync(10_000)
      const out = await pending

      expect(query).toHaveBeenCalledTimes(3)
      expect(times).toEqual([0, 150, 750])
      expect((out as { error: unknown }).error).toBe(errors[2])
      expect(isPrismaCircuitOpen()).toBe(false)
      expect(warnLines()).toEqual(["[prisma] P2024 — retry 1/2 in 150ms", "[prisma] P2024 — retry 2/2 in 600ms"])
    })

    it("succeeds on the third attempt: returns that result, every attempt receives the SAME args object", async () => {
      const args = { take: 3 }
      const result = [{ id: 1 }]
      const seen: unknown[] = []
      let n = 0
      const query = vi.fn(async (a: unknown) => {
        seen.push(a)
        if (++n < 3) throw p2024(n)
        return result
      })

      const pending = allOps({ model: "Product", operation: "findMany", args, query })
      await vi.advanceTimersByTimeAsync(10_000)

      expect(await pending).toBe(result)
      expect(query).toHaveBeenCalledTimes(3)
      for (const a of seen) expect(a).toBe(args)
    })
  })

  describe("retryable but not 'unreachable' errors: two retries with 50 ms then 200 ms", () => {
    it.each([
      ["connection reset by peer", new Error("read ECONNRESET: connection reset by peer")],
      ["Engine was empty", new Error("Engine was empty")],
      ["E57P01", new Error("terminating connection due to administrator command (E57P01)")],
    ])("%s: three attempts at t=0, 50, 250 ms, last error object thrown, circuit stays closed", async (_name, base) => {
      const errors = [base, new Error(base.message), new Error(base.message)]
      const times: number[] = []
      const t0 = Date.now()
      const query = vi.fn(async () => {
        times.push(Date.now() - t0)
        throw errors[times.length - 1]
      })

      const pending = settle(allOps({ model: "User", operation: "findUnique", args: {}, query }))
      await vi.advanceTimersByTimeAsync(10_000)
      const out = await pending

      expect(times).toEqual([0, 50, 250])
      expect((out as { error: unknown }).error).toBe(errors[2])
      expect(isPrismaCircuitOpen()).toBe(false)
      expect(warnLines()).toEqual(["[prisma] connection — retry 1/2 in 50ms", "[prisma] connection — retry 2/2 in 200ms"])
    })
  })

  describe("non-retryable and non-standard failures: one attempt, the very same rejection value", () => {
    it("a non-connection Prisma error (P2002) is rethrown untouched, no warning, circuit closed", async () => {
      const error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      const query = vi.fn(async () => {
        throw error
      })
      const out = await settle(allOps({ model: "User", operation: "create", args: {}, query }))
      expect((out as { error: unknown }).error).toBe(error)
      expect(query).toHaveBeenCalledTimes(1)
      expect(warnLines()).toEqual([])
      expect(isPrismaCircuitOpen()).toBe(false)
    })

    it.each([
      ["a string", "boom"],
      ["null", null],
      ["undefined", undefined],
      ["a number", 0],
      ["a plain object without code", { reason: "x" }],
    ])("rejecting with %s is propagated as is after exactly one attempt", async (_name, thrown) => {
      const query = vi.fn(async () => {
        throw thrown
      })
      const out = await settle(allOps({ model: "M", operation: "findMany", args: {}, query }))
      expect("error" in out).toBe(true)
      expect(Object.is((out as { error: unknown }).error, thrown)).toBe(true)
      expect(query).toHaveBeenCalledTimes(1)
      expect(isPrismaCircuitOpen()).toBe(false)
    })

    it("a plain object carrying a P1017 code (not an Error) still opens the circuit and is rethrown as the same object", async () => {
      const thrown = { code: "P1017", message: "closed" }
      const query = vi.fn(async () => {
        throw thrown
      })
      const out = await settle(allOps({ model: "M", operation: "findMany", args: {}, query }))
      expect((out as { error: unknown }).error).toBe(thrown)
      expect(query).toHaveBeenCalledTimes(1)
      expect(isPrismaCircuitOpen()).toBe(true)
    })

    it("a query function that throws SYNCHRONOUSLY is handled exactly like a rejection", async () => {
      const error = p2024(1)
      const query = vi.fn((): Promise<unknown> => {
        throw error
      })
      const pending = settle(allOps({ model: "M", operation: "findMany", args: {}, query }))
      await vi.advanceTimersByTimeAsync(10_000)
      const out = await pending
      expect(query).toHaveBeenCalledTimes(3) // P2024 retried twice, as for an async rejection
      expect((out as { error: unknown }).error).toBe(error)
    })
  })

  describe("the circuit is process-wide state", () => {
    it("a success CLOSES a circuit that another operation opened while it was in flight", async () => {
      let release!: (v: string) => void
      const slow = vi.fn(() => new Promise<string>((resolve) => (release = resolve)))
      const failing = vi.fn(async () => {
        throw p1017()
      })

      const inFlight = allOps({ model: "A", operation: "findMany", args: {}, query: slow })
      await settle(allOps({ model: "B", operation: "findMany", args: {}, query: failing }))
      expect(isPrismaCircuitOpen()).toBe(true) // B opened it while A was still running

      release("done")
      expect(await inFlight).toBe("done")
      expect(isPrismaCircuitOpen()).toBe(false) // A's success cleared it
    })
  })

  describe("independence of concurrent operations", () => {
    it("two operations in flight do not share attempt counters: one fails with P2024, the other succeeds first time", async () => {
      const okQuery = vi.fn(async () => "fine")
      let n = 0
      const failing = vi.fn(async () => {
        if (++n < 3) throw p2024(n)
        return "late"
      })

      const a = allOps({ model: "A", operation: "findMany", args: {}, query: failing })
      const b = allOps({ model: "B", operation: "findMany", args: {}, query: okQuery })
      await vi.advanceTimersByTimeAsync(10_000)

      expect(await b).toBe("fine")
      expect(await a).toBe("late")
      expect(okQuery).toHaveBeenCalledTimes(1)
      expect(failing).toHaveBeenCalledTimes(3)
    })
  })
})

/**
 * Observations that only exist with the diagnostics ON. They never replace the characterization above: that one must hold in both modes.
 */
describe("diagnostics ON — what the wrapper records around the real extension", () => {
  const diagLines = () => consoleLog.mock.calls.filter((c) => c[0] === "[prisma_diag]").map((c) => c[1] as Record<string, unknown>)

  beforeEach(() => {
    __resetPrismaDiagnosticsForTests()
    __setPrismaDiagnosticsEnabledForTests(true)
    consoleLog.mockClear()
  })

  afterEach(() => {
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
    __setPrismaDiagnosticsEnabledForTests(null)
  })

  it("a successful operation leaves no line at all", async () => {
    await allOps({ model: "Product", operation: "findMany", args: { where: { name: "Secret product" } }, query: async () => [{ id: "x" }] })
    expect(diagLines()).toEqual([])
  })

  it("P1017: one OP_ERROR with a single attempt, class unreachable, circuit closed at start and open at the end", async () => {
    await settle(allOps({ model: "AffiliateProduct", operation: "findMany", args: {}, query: async () => { throw p1017() } }))
    const lines = diagLines()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      event: "OP_ERROR", op: "AffiliateProduct.findMany", attempts: 1, error_class: "unreachable", error_code: "P1017",
      circuit_at_start: false, circuit_at_end: true, circuit_opened_during: true,
    })
  })

  it("P2024 retried twice: attempts = 3, class pool_timeout, circuit never opened", async () => {
    const pending = settle(allOps({ model: "Product", operation: "findMany", args: {}, query: async () => { throw p2024(1) } }))
    await vi.advanceTimersByTimeAsync(10_000)
    await pending
    expect(diagLines()[0]).toMatchObject({ event: "OP_ERROR", op: "Product.findMany", attempts: 3, error_class: "pool_timeout", error_code: "P2024", circuit_opened_during: false })
  })

  it("an operation rejected because the circuit was already open is recorded as such only if it is slow (it is not): no line", async () => {
    await settle(allOps({ model: "Product", operation: "findMany", args: {}, query: async () => { throw p1017() } }))
    consoleLog.mockClear()
    await settle(allOps({ model: "Product", operation: "findMany", args: {}, query: async () => "never" }))
    expect(diagLines()).toEqual([])
  })

  it("raw entry points are recorded without a model", async () => {
    await settle(reconnect.query.$queryRaw!({ args: [["SELECT secret FROM x"]], query: async () => { throw p1017() } }))
    const lines = diagLines()
    expect(lines[0]).toMatchObject({ op: "$queryRaw", error_code: "P1017" })
    expect(JSON.stringify(lines)).not.toMatch(/SELECT|secret/)
  })

  it("never logs arguments, results or error text", async () => {
    const args = { where: { email: "alice@example.com" }, data: { name: "Secret Product Name", image: "https://cdn.example/p.jpg" } }
    const error = Object.assign(new Error("Invalid `prisma.user.findMany()` invocation: connection to postgresql://u:s3cret@ep-x.neon.tech/db lost"), { code: "P1017" })
    await settle(allOps({ model: "User", operation: "findMany", args, query: async () => { throw error } }))
    expect(JSON.stringify(diagLines())).not.toMatch(/alice|example|Secret|cdn\.|postgresql|s3cret|neon|invocation|lost/)
  })

  it("E1 through the real extension: an operation that completes after a long pause and before any late tick says so, and rejects with the SAME error object", async () => {
    let t = 1_000_000
    __setPrismaDiagnosticsClockForTests({ wall: () => 1_800_000_000_000 + t, mono: () => t })
    noteHeartbeatTick() // the last heartbeat tick, as the heartbeat itself stamps it
    const error = p1017()
    const out = await settle(allOps({ model: "Product", operation: "findMany", args: {}, query: async () => { t += 300_000; throw error } }))
    expect("error" in out && out.error).toBe(error)
    const lines = diagLines()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ event: "OP_ERROR", attempts: 1, duration_ms: 300_000, gap_overlap_reported_ms: 0, tick_age_ms: 300_000 })
  })

  it.each([
    ["a result", false],
    ["a rejection", true],
  ])("a diagnostic clock that breaks between the start and the end of the operation changes neither %s nor its identity", async (_name, rejects) => {
    let broken = false
    const reading = () => {
      if (broken) throw new Error("diagnostic clock down")
      return Date.now()
    }
    __setPrismaDiagnosticsClockForTests({ wall: reading, mono: reading })
    noteHeartbeatTick()
    const result = { rows: [1, 2, 3] }
    const error = p1017()
    const query = vi.fn(async () => {
      broken = true
      if (rejects) throw error
      return result
    })
    const out = await settle(allOps({ model: "Product", operation: "findMany", args: {}, query }))
    if (rejects) expect("error" in out && out.error).toBe(error)
    else expect("value" in out && out.value).toBe(result)
    expect(query).toHaveBeenCalledTimes(1)
    expect(__prismaDiagnosticsStateForTests().inflight).toBe(0)
  })

  it("a log output that throws when the diagnostic line is written does not replace the Prisma error", async () => {
    const error = p1017()
    consoleLog.mockImplementation(() => {
      throw new Error("stdout closed")
    })
    try {
      const out = await settle(allOps({ model: "Product", operation: "findMany", args: {}, query: async () => { throw error } }))
      expect("error" in out && out.error).toBe(error)
    } finally {
      consoleLog.mockImplementation(() => {})
    }
  })
})
