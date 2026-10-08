import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const logSpy = vi.hoisted(() => vi.fn())
vi.mock("@/lib/business-log", () => ({
  logBusiness: (module: string, payload: Record<string, unknown>) => logSpy(module, payload),
}))

import {
  __resetHomeRaceDiagnosticsForTests,
  HOME_RACE_LOG_MODULE,
  startHomeRace,
  type HomeRaceProbe,
} from "@/lib/home-race-diagnostics"

type Logged = Record<string, unknown>

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Every payload the probe logged, in order. */
const logged = (): Logged[] => logSpy.mock.calls.map((call) => call[1] as Logged)
const eventNames = (): string[] => logged().map((payload) => String(payload.event))
const eventOf = (name: string): Logged => {
  const found = logged().find((payload) => payload.event === name)
  if (!found) throw new Error(`event ${name} was not logged (logged: ${eventNames().join(",") || "none"})`)
  return found
}

/** Same shape as the four instrumented call sites: `Promise.race([probe.watch(work), timer → fallback + onTimeout])`. */
function instrumentedRace<T>(probe: HomeRaceProbe, work: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    probe.watch(work),
    new Promise<T>((resolve) =>
      setTimeout(() => {
        resolve(fallback)
        probe.onTimeout()
      }, timeoutMs)
    ),
  ])
}

const PRISMA_POOL_ERROR = Object.assign(new Error("Timed out fetching a new connection from the connection pool"), {
  code: "P2024",
})

let unhandled: unknown[] = []
const onUnhandled = (reason: unknown) => unhandled.push(reason)

beforeEach(() => {
  vi.useFakeTimers()
  logSpy.mockReset()
  __resetHomeRaceDiagnosticsForTests()
  unhandled = []
  process.on("unhandledRejection", onUnhandled)
})

afterEach(() => {
  process.off("unhandledRejection", onUnhandled)
  vi.useRealTimers()
})

describe("home race diagnostics — outcomes", () => {
  it("1. the work wins before the timeout: START then RACE_WON, and no TIMEOUT when the (uncleared) timer fires later", async () => {
    const probe = startHomeRace("home_shops", 2500)
    const work = deferred<string[]>()
    const race = instrumentedRace(probe, work.promise, 2500, [])

    await vi.advanceTimersByTimeAsync(300)
    work.resolve(["shop"])
    await expect(race).resolves.toEqual(["shop"])
    await vi.advanceTimersByTimeAsync(5000) // the original timer is not cleared in this race: it fires, and must stay silent

    expect(eventNames()).toEqual(["START", "RACE_WON"])
    expect(eventOf("RACE_WON")).toMatchObject({
      loader: "home_shops",
      race_id: probe.raceId,
      timeout_ms: 2500,
      outcome: "SETTLED_BEFORE_TIMEOUT",
      elapsed_ms: 300,
      inflight_after: 0,
    })
    expect(eventOf("RACE_WON")).not.toHaveProperty("still_running")
    expect(eventOf("RACE_WON")).not.toHaveProperty("after_timeout_ms")
    expect(logSpy.mock.calls.every((call) => call[0] === HOME_RACE_LOG_MODULE)).toBe(true)
  })

  it("2. the timeout wins while the work is pending: TIMEOUT with still_running, elapsed and inflight", async () => {
    const probe = startHomeRace("home_flash_deals", 2000)
    const work = deferred<string[]>()
    const race = instrumentedRace(probe, work.promise, 2000, ["fallback"])

    await vi.advanceTimersByTimeAsync(2000)
    await expect(race).resolves.toEqual(["fallback"])

    expect(eventNames()).toEqual(["START", "TIMEOUT"])
    expect(eventOf("START")).toMatchObject({ loader: "home_flash_deals", inflight_before: 0, timeout_ms: 2000 })
    expect(eventOf("TIMEOUT")).toMatchObject({
      loader: "home_flash_deals",
      race_id: probe.raceId,
      outcome: "TIMEOUT",
      elapsed_ms: 2000,
      still_running: true,
      inflight: 1,
    })
  })

  it("3. the work settles after the timeout: PROMISE_SETTLED_AFTER_TIMEOUT", async () => {
    const probe = startHomeRace("home_best_sellers_7d", 2500)
    const work = deferred<string[]>()
    const race = instrumentedRace(probe, work.promise, 2500, [])

    await vi.advanceTimersByTimeAsync(2500)
    await expect(race).resolves.toEqual([])
    await vi.advanceTimersByTimeAsync(1200)
    work.resolve(["late"])
    await vi.advanceTimersByTimeAsync(0)

    expect(eventNames()).toEqual(["START", "TIMEOUT", "PROMISE_SETTLED_AFTER_TIMEOUT"])
    expect(eventOf("PROMISE_SETTLED_AFTER_TIMEOUT")).toMatchObject({
      race_id: probe.raceId,
      outcome: "SETTLED_AFTER_TIMEOUT",
      inflight_after: 0,
    })
    expect(eventNames()).not.toContain("RACE_WON")
  })

  it("4. the work fails before the timeout: ERROR (name + Prisma code), and the caller still gets the same rejection", async () => {
    const probe = startHomeRace("home_shell", 12_000)
    const work = deferred<never>()
    const race = instrumentedRace(probe, work.promise, 12_000, undefined as never)
    const caught = race.then(
      () => undefined,
      (error: unknown) => error
    )

    await vi.advanceTimersByTimeAsync(700)
    work.reject(PRISMA_POOL_ERROR)

    expect(await caught).toBe(PRISMA_POOL_ERROR)
    expect(eventNames()).toEqual(["START", "ERROR"])
    expect(eventOf("ERROR")).toMatchObject({
      outcome: "ERROR_BEFORE_TIMEOUT",
      elapsed_ms: 700,
      error_name: "Error",
      error_code: "P2024",
      inflight_after: 0,
    })
    expect(unhandled).toEqual([])
  })

  it("5. the work fails after the timeout: ERROR_AFTER_TIMEOUT, no unhandled rejection", async () => {
    const probe = startHomeRace("home_shops", 2500)
    const work = deferred<never>()
    const race = instrumentedRace(probe, work.promise, 2500, [] as never)

    await vi.advanceTimersByTimeAsync(2500)
    await expect(race).resolves.toEqual([])
    await vi.advanceTimersByTimeAsync(900)
    work.reject(PRISMA_POOL_ERROR)
    await vi.advanceTimersByTimeAsync(0)

    expect(eventNames()).toEqual(["START", "TIMEOUT", "ERROR_AFTER_TIMEOUT"])
    expect(eventOf("ERROR_AFTER_TIMEOUT")).toMatchObject({
      outcome: "ERROR_AFTER_TIMEOUT",
      error_name: "Error",
      error_code: "P2024",
    })
    expect(unhandled).toEqual([])
  })

  it("6. after_timeout_ms is measured from the timeout, elapsed_ms from the start", async () => {
    const probe = startHomeRace("home_flash_deals", 2000)
    const work = deferred<string[]>()
    void instrumentedRace(probe, work.promise, 2000, [])

    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(750)
    work.resolve([])
    await vi.advanceTimersByTimeAsync(0)

    expect(eventOf("PROMISE_SETTLED_AFTER_TIMEOUT")).toMatchObject({ elapsed_ms: 2750, after_timeout_ms: 750 })
    expect(eventOf("TIMEOUT")).toMatchObject({ elapsed_ms: 2000 })
  })

  it("7. still_running is true on TIMEOUT only, and TIMEOUT is not logged when the work already settled", async () => {
    const lost = startHomeRace("home_shops", 1000)
    const lostWork = deferred<string[]>()
    void instrumentedRace(lost, lostWork.promise, 1000, [])
    await vi.advanceTimersByTimeAsync(1000)
    lostWork.resolve([])
    await vi.advanceTimersByTimeAsync(0)

    const won = startHomeRace("home_flash_deals", 1000)
    void instrumentedRace(won, Promise.resolve([] as string[]), 1000, [])
    await vi.advanceTimersByTimeAsync(5000)

    const withStillRunning = logged().filter((payload) => "still_running" in payload)
    expect(withStillRunning).toHaveLength(1)
    expect(withStillRunning[0]).toMatchObject({ event: "TIMEOUT", race_id: lost.raceId, still_running: true })
    expect(logged().filter((payload) => payload.race_id === won.raceId).map((p) => p.event)).toEqual(["START", "RACE_WON"])
  })
})

describe("home race diagnostics — neutrality", () => {
  it("8. a failing logger never reaches the application path", async () => {
    logSpy.mockImplementation(() => {
      throw new Error("log drain exploded")
    })
    const probe = startHomeRace("home_shell", 1000)
    const work = deferred<string>()

    let race!: Promise<string>
    expect(() => {
      race = instrumentedRace(probe, work.promise, 1000, "fallback")
    }).not.toThrow()
    await vi.advanceTimersByTimeAsync(1000)
    await expect(race).resolves.toBe("fallback")
    expect(() => probe.onTimeout()).not.toThrow()

    work.resolve("late value")
    await vi.advanceTimersByTimeAsync(0)
    expect(logSpy).toHaveBeenCalled() // it did try to log
    expect(unhandled).toEqual([])

    const won = startHomeRace("home_shell", 1000)
    await expect(instrumentedRace(won, Promise.resolve("ok"), 1000, "fallback")).resolves.toBe("ok")
  })

  it("9. watch returns the very same promise (identity), for pending, resolved and rejected work", async () => {
    const pending = deferred<number>()
    expect(startHomeRace("a", 100).watch(pending.promise)).toBe(pending.promise)

    const resolved = Promise.resolve(42)
    expect(startHomeRace("b", 100).watch(resolved)).toBe(resolved)

    const rejected = Promise.reject(PRISMA_POOL_ERROR)
    const watched = startHomeRace("c", 100).watch(rejected)
    expect(watched).toBe(rejected)
    await expect(watched).rejects.toBe(PRISMA_POOL_ERROR) // same error object, not wrapped
    await expect(resolved).resolves.toBe(42) // value untouched
    pending.resolve(1)
    await expect(pending.promise).resolves.toBe(1)
  })

  it("9b. a probe observes only the first promise it is given", async () => {
    const probe = startHomeRace("home_shops", 100)
    const first = deferred<number>()
    const second = deferred<number>()
    expect(probe.watch(first.promise)).toBe(first.promise)
    expect(probe.watch(second.promise)).toBe(second.promise)

    expect(eventNames()).toEqual(["START"])
    second.resolve(2)
    await vi.advanceTimersByTimeAsync(0)
    expect(eventNames()).toEqual(["START"]) // the second promise is not observed
  })

  it("10. the loader runs exactly once, at the same moment, whatever the outcome", async () => {
    const run = async (outcome: "win" | "timeout" | "late" | "fail") => {
      const work = deferred<string>()
      const loader = vi.fn(() => work.promise)
      const probe = startHomeRace(`home_${outcome}`, 1000)

      expect(loader).not.toHaveBeenCalled() // startHomeRace starts nothing
      const race = Promise.race([
        probe.watch(loader()),
        new Promise<string>((resolve) =>
          setTimeout(() => {
            resolve("fallback")
            probe.onTimeout()
          }, 1000)
        ),
      ])
      expect(loader).toHaveBeenCalledTimes(1) // already called, synchronously, by the time the race exists

      if (outcome === "win") work.resolve("v")
      if (outcome === "fail") work.reject(PRISMA_POOL_ERROR)
      const settled = race.catch((error: unknown) => error)
      await vi.advanceTimersByTimeAsync(1000)
      if (outcome === "late") work.resolve("v")
      await vi.advanceTimersByTimeAsync(0)
      await settled
      expect(loader).toHaveBeenCalledTimes(1)
    }

    for (const outcome of ["win", "timeout", "late", "fail"] as const) await run(outcome)
    expect(unhandled).toEqual([])
  })

  it("11. the race returns the same result with and without the probe", async () => {
    const scenarios: Array<{ settleAt: number; reject: boolean }> = [
      { settleAt: 200, reject: false },
      { settleAt: 200, reject: true },
      { settleAt: 1500, reject: false },
      { settleAt: 1500, reject: true },
    ]
    for (const { settleAt, reject } of scenarios) {
      const outcomes: unknown[] = []
      for (const probed of [false, true]) {
        const work = new Promise<string>((resolve, rejectWork) =>
          setTimeout(() => (reject ? rejectWork(PRISMA_POOL_ERROR) : resolve("value")), settleAt)
        )
        const probe = startHomeRace("home_shell", 1000)
        const timer = new Promise<string>((resolve) =>
          setTimeout(() => {
            resolve("fallback")
            if (probed) probe.onTimeout()
          }, 1000)
        )
        const race = Promise.race([probed ? probe.watch(work) : work, timer])
        const settled = race.then(
          (value) => ({ value }),
          (error: unknown) => ({ error })
        )
        await vi.advanceTimersByTimeAsync(2000)
        outcomes.push(await settled)
      }
      expect(outcomes[1]).toEqual(outcomes[0])
    }
    expect(unhandled).toEqual([])
  })
})

describe("home race diagnostics — data minimisation and bookkeeping", () => {
  it("never logs an error message, a stack, or a non-Prisma code", async () => {
    const secretish = Object.assign(new Error("SELECT * FROM \"User\" WHERE email = 'a@b.c' (postgres://u:p@host/db)"), {
      code: "ECONNRESET",
      stack: "Error: SELECT ... at /var/task/secret.js:1",
    })
    const probe = startHomeRace("home_shell", 1000)
    const work = deferred<never>()
    void instrumentedRace(probe, work.promise, 1000, undefined as never)
    work.reject(secretish)
    await vi.advanceTimersByTimeAsync(0)

    const text = JSON.stringify(logged())
    expect(text).not.toContain("SELECT")
    expect(text).not.toContain("postgres://")
    expect(text).not.toContain("secret.js")
    expect(text).not.toContain("ECONNRESET")
    expect(eventOf("ERROR")).toMatchObject({ error_name: "Error" })
    expect(eventOf("ERROR").error_code).toBeUndefined()
  })

  it("counts watched promises still pending in this process (abandoned losers included)", async () => {
    const a = startHomeRace("home_shops", 100)
    const b = startHomeRace("home_flash_deals", 100)
    const workA = deferred<void>()
    const workB = deferred<void>()
    void instrumentedRace(a, workA.promise, 100, undefined)
    void instrumentedRace(b, workB.promise, 100, undefined)
    await vi.advanceTimersByTimeAsync(100)

    expect(logged().find((p) => p.event === "START" && p.race_id === b.raceId)).toMatchObject({ inflight_before: 1 })
    expect(logged().find((p) => p.event === "TIMEOUT" && p.race_id === a.raceId)).toMatchObject({ inflight: 2 })

    workA.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(logged().find((p) => p.event === "PROMISE_SETTLED_AFTER_TIMEOUT" && p.race_id === a.raceId)).toMatchObject({
      inflight_after: 1,
    })
    workB.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(logged().find((p) => p.event === "PROMISE_SETTLED_AFTER_TIMEOUT" && p.race_id === b.raceId)).toMatchObject({
      inflight_after: 0,
    })
  })

  it("gives every race a distinct race_id and a stable per-process instance id", () => {
    const probes = [startHomeRace("a", 1), startHomeRace("b", 1), startHomeRace("c", 1)]
    for (const probe of probes) probe.watch(Promise.resolve())
    const ids = logged().map((p) => p.race_id)
    expect(new Set(ids).size).toBe(3)
    expect(new Set(logged().map((p) => p.instance)).size).toBe(1)
    expect(typeof logged()[0].ts).toBe("string")
  })

  it("onTimeout before watch, after settling, or called twice logs nothing extra", async () => {
    const early = startHomeRace("home_shops", 100)
    early.onTimeout()
    expect(logSpy).not.toHaveBeenCalled()

    const probe = startHomeRace("home_shops", 100)
    const work = deferred<void>()
    probe.watch(work.promise)
    probe.onTimeout()
    probe.onTimeout()
    expect(eventNames().filter((name) => name === "TIMEOUT")).toHaveLength(1)

    work.resolve()
    await vi.advanceTimersByTimeAsync(0)
    probe.onTimeout()
    expect(eventNames().filter((name) => name === "TIMEOUT")).toHaveLength(1)
  })

  it("extra fields are lazy, bounded, and a throwing extra cannot break onTimeout", async () => {
    const withExtra = startHomeRace("home_shell", 100)
    withExtra.watch(new Promise(() => undefined))
    withExtra.onTimeout(() => ({ parts_finished: "x".repeat(500) }))
    expect(String(eventOf("TIMEOUT").parts_finished)).toHaveLength(120)

    logSpy.mockReset()
    const throwing = startHomeRace("home_shell", 100)
    throwing.watch(new Promise(() => undefined))
    expect(() =>
      throwing.onTimeout(() => {
        throw new Error("boom")
      })
    ).not.toThrow()
    expect(eventNames()).toEqual(["START", "TIMEOUT"])

    logSpy.mockReset()
    const notWatching = startHomeRace("home_shell", 100)
    const extra = vi.fn(() => ({ parts_finished: "a" }))
    notWatching.onTimeout(extra)
    expect(extra).not.toHaveBeenCalled()
  })
})
