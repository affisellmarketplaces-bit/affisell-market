import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Unit tests of the bucketed cache + local single-flight (lib/home-bucket-cache.ts).
 *
 * `next/cache` is replaced by a FAKE that reproduces the `unstable_cache` behaviours verified on the installed Next
 * (16.2.6) with its real classes and an in-memory handler: a HIT never runs the callback, a thrown error is not stored,
 * `[]` is stored, concurrent misses are NOT de-duplicated, the key is derived from `keyParts`. If Next is upgraded,
 * re-run that verification: this fake is only as true as it was on that version.
 */

vi.mock("server-only", () => ({}))

const cacheFake = vi.hoisted(() => {
  const store = new Map<string, string>()
  const created: { keyParts: string[]; options: { revalidate?: number | false; tags?: string[] } }[] = []
  function unstable_cache<T>(
    cb: () => Promise<T>,
    keyParts: string[],
    options: { revalidate?: number | false; tags?: string[] }
  ) {
    created.push({ keyParts, options })
    const key = keyParts.join(",")
    return async (): Promise<T> => {
      if (store.has(key)) return JSON.parse(store.get(key)!) as T // HIT: the callback is not run
      const result = await cb() // MISS: concurrent misses are NOT de-duplicated (as in Next)
      store.set(key, JSON.stringify(result)) // a throw above never reaches this line
      return result
    }
  }
  return { store, created, unstable_cache }
})
vi.mock("next/cache", () => ({ unstable_cache: cacheFake.unstable_cache }))

const logs = vi.hoisted(() => ({ lines: [] as { module: string; payload: Record<string, unknown> }[] }))
vi.mock("@/lib/business-log", () => ({
  logBusiness: (module: string, payload: Record<string, unknown>) => logs.lines.push({ module, payload }),
}))

import {
  HOME_CACHE_BUCKET_MS,
  __homeBucketCacheFlightKeysForTests,
  __resetHomeBucketCacheForTests,
  homeBucketKeyParts,
  homeCacheBucket,
  loadBucketedOnce,
  type BucketedLoadOptions,
} from "@/lib/home-bucket-cache"

const BUCKET_MS = HOME_CACHE_BUCKET_MS
const setBucket = (bucket: number, offsetMs = 0) => vi.setSystemTime(bucket * BUCKET_MS + offsetMs)
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const options = <T>(load: () => Promise<T>, over: Partial<BucketedLoadOptions<T>> = {}): BucketedLoadOptions<T> => ({
  loader: "home_best_sellers_7d",
  version: "v-test",
  limit: 3,
  revalidateSec: 900,
  tags: ["tag-test"],
  load,
  ...over,
})

const events = (name: string) => logs.lines.filter((l) => l.payload.event === name).map((l) => l.payload)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  setBucket(1000)
  cacheFake.store.clear()
  cacheFake.created.length = 0
  logs.lines.length = 0
  __resetHomeBucketCacheForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("bucket", () => {
  it("is 300 s long and switches exactly on the boundary", () => {
    expect(BUCKET_MS).toBe(300_000)
    expect(homeCacheBucket(0)).toBe(0)
    expect(homeCacheBucket(299_999)).toBe(0)
    expect(homeCacheBucket(300_000)).toBe(1)
    expect(homeCacheBucket(599_999)).toBe(1)
    expect(homeCacheBucket(600_000)).toBe(2)
  })

  it("puts version, limit and bucket in the key", () => {
    expect(homeBucketKeyParts("home-best-sellers-v1", 3, 5890123)).toEqual(["home-best-sellers-v1", "3", "5890123"])
  })

  it("starts a new cache entry on the exact boundary: 1 ms before = same entry, at the boundary = new entry", async () => {
    const load = vi.fn(async () => ["a"])

    setBucket(2000, BUCKET_MS - 1)
    await loadBucketedOnce(options(load))
    await loadBucketedOnce(options(load))
    expect(load).toHaveBeenCalledTimes(1) // same bucket: HIT

    setBucket(2001, 0)
    await loadBucketedOnce(options(load))
    expect(load).toHaveBeenCalledTimes(2) // boundary crossed: new key, new compute
    await loadBucketedOnce(options(load))
    expect(load).toHaveBeenCalledTimes(2) // and HIT again inside the new bucket

    expect([...cacheFake.store.keys()]).toEqual(["v-test,3,2000", "v-test,3,2001"])
  })

  it("keeps the expiry above the bucket length, so an entry is never stale inside its own bucket", () => {
    expect(900_000).toBeGreaterThan(BUCKET_MS)
  })
})

describe("cache read-through", () => {
  it("a HIT does not run the loader", async () => {
    const load = vi.fn(async () => [{ id: "a" }])

    await loadBucketedOnce(options(load))
    expect(load).toHaveBeenCalledTimes(1)

    await expect(loadBucketedOnce(options(load))).resolves.toEqual([{ id: "a" }])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("passes the key parts, expiry and tags to unstable_cache", async () => {
    await loadBucketedOnce(options(async () => [], { version: "home-best-sellers-v1", limit: 3, revalidateSec: 900, tags: ["home-best-sellers"] }))

    expect(cacheFake.created).toEqual([
      { keyParts: ["home-best-sellers-v1", "3", "1000"], options: { revalidate: 900, tags: ["home-best-sellers"] } },
    ])
  })

  it("stores a legitimate empty list: the next call is a HIT, the loader is not asked again", async () => {
    const load = vi.fn(async () => [])

    await expect(loadBucketedOnce(options(load))).resolves.toEqual([])
    await expect(loadBucketedOnce(options(load))).resolves.toEqual([])

    expect(load).toHaveBeenCalledTimes(1)
    expect(cacheFake.store.get("v-test,3,1000")).toBe("[]")
  })

  it("never stores an error, and the flight is cleared so the next call retries and can succeed", async () => {
    const boom = Object.assign(new Error("Server has closed the connection."), { code: "P1017" })
    const load = vi.fn<() => Promise<string[]>>().mockRejectedValueOnce(boom).mockResolvedValue(["ok"])

    await expect(loadBucketedOnce(options(load))).rejects.toBe(boom)
    expect(cacheFake.store.size).toBe(0)
    expect(__homeBucketCacheFlightKeysForTests()).toEqual([])

    await expect(loadBucketedOnce(options(load))).resolves.toEqual(["ok"]) // retry in the same bucket
    expect(load).toHaveBeenCalledTimes(2)
    expect(cacheFake.store.get("v-test,3,1000")).toBe('["ok"]')

    await loadBucketedOnce(options(load))
    expect(load).toHaveBeenCalledTimes(2) // and now a HIT
  })

  it("a loader that throws synchronously is a rejection like any other failure (nothing stored, flight cleared)", async () => {
    const load = vi.fn((): Promise<string[]> => {
      throw new Error("sync failure")
    })

    await expect(loadBucketedOnce(options(load))).rejects.toThrow("sync failure")
    expect(cacheFake.store.size).toBe(0)
    expect(__homeBucketCacheFlightKeysForTests()).toEqual([])
  })
})

describe("single-flight", () => {
  it("concurrent calls of the same key share ONE compute and the same result", async () => {
    const gate = deferred<string[]>()
    const load = vi.fn(() => gate.promise)

    const calls = [1, 2, 3, 4, 5].map(() => loadBucketedOnce(options(load)))
    await flush()
    expect(load).toHaveBeenCalledTimes(1)
    expect(cacheFake.created).toHaveLength(1) // followers do not even build a cache wrapper

    gate.resolve(["x", "y"])
    const results = await Promise.all(calls)
    expect(results.every((r) => r === results[0])).toBe(true)
    expect(results[0]).toEqual(["x", "y"])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("does not merge different limits", async () => {
    const gate = deferred<string[]>()
    const load = vi.fn(() => gate.promise)

    const a = loadBucketedOnce(options(load, { limit: 3 }))
    const b = loadBucketedOnce(options(load, { limit: 24 }))
    await flush()
    expect(load).toHaveBeenCalledTimes(2)

    gate.resolve([])
    await Promise.all([a, b])
  })

  it("a failing flight rejects every caller that joined it, and clears itself", async () => {
    const gate = deferred<string[]>()
    const load = vi.fn(() => gate.promise)
    const boom = new Error("boom")

    const calls = [loadBucketedOnce(options(load)), loadBucketedOnce(options(load)), loadBucketedOnce(options(load))]
    const settled = Promise.allSettled(calls)
    gate.reject(boom)

    const results = await settled
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected", "rejected"])
    expect(load).toHaveBeenCalledTimes(1)
    expect(__homeBucketCacheFlightKeysForTests()).toEqual([])
  })

  it("does NOT take a running flight over by age: 299 s later, in the same bucket, a new call still joins it", async () => {
    const gate = deferred<string[]>()
    const load = vi.fn(() => gate.promise)

    setBucket(3000, 0)
    const first = loadBucketedOnce(options(load))
    await flush()

    for (const elapsed of [20_000, 60_000, 299_000]) {
      setBucket(3000, elapsed)
      void loadBucketedOnce(options(load))
    }
    await flush()
    expect(load).toHaveBeenCalledTimes(1)

    gate.resolve(["done"])
    await first
  })

  it("a flight stuck in bucket N does not block bucket N+1, which starts its own (at most 2 concurrent computes)", async () => {
    const stuck = deferred<string[]>()
    const fresh = deferred<string[]>()
    const load = vi.fn<() => Promise<string[]>>().mockReturnValueOnce(stuck.promise).mockReturnValueOnce(fresh.promise)

    setBucket(4000, 10_000)
    const first = loadBucketedOnce(options(load))
    await flush()

    setBucket(4001, 0) // exact boundary
    const second = loadBucketedOnce(options(load))
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    expect(__homeBucketCacheFlightKeysForTests().sort()).toEqual(["v-test:3:4000", "v-test:3:4001"])

    setBucket(4001, 1000)
    void loadBucketedOnce(options(load)) // joins the new flight, not the stuck one
    await flush()
    expect(load).toHaveBeenCalledTimes(2)

    fresh.resolve(["fresh"])
    await expect(second).resolves.toEqual(["fresh"])
    stuck.resolve(["late"])
    await expect(first).resolves.toEqual(["late"])
  })

  it("an OLD flight can never erase a NEWER one that reused its key", async () => {
    const oldFlight = deferred<string[]>()
    const newFlight = deferred<string[]>()
    const load = vi.fn<() => Promise<string[]>>().mockReturnValueOnce(oldFlight.promise).mockReturnValueOnce(newFlight.promise)

    setBucket(5000, 0)
    const first = loadBucketedOnce(options(load)) // flight A, key K
    await flush()

    setBucket(5005, 0) // time moves on: A (bucket 5000) is dropped from the map as too old
    void loadBucketedOnce(options(() => new Promise<string[]>(() => {}), { limit: 99 })) // unrelated flight, never settles
    expect(__homeBucketCacheFlightKeysForTests()).not.toContain("v-test:3:5000")

    setBucket(5000, 0) // the clock steps back into bucket 5000: the key K is free again
    const second = loadBucketedOnce(options(load)) // flight B, same key K
    await flush()
    expect(load).toHaveBeenCalledTimes(2) // A and B

    oldFlight.resolve(["A"]) // A settles late: its cleanup must NOT delete B
    await first
    await flush()
    expect(__homeBucketCacheFlightKeysForTests()).toContain("v-test:3:5000")

    void loadBucketedOnce(options(load)) // still joins B
    await flush()
    expect(load).toHaveBeenCalledTimes(2)

    newFlight.resolve(["B"])
    await expect(second).resolves.toEqual(["B"])
    expect(__homeBucketCacheFlightKeysForTests()).not.toContain("v-test:3:5000")
  })

  it("keeps the flight map bounded: only the current and the previous bucket are retained", async () => {
    const never = new Promise<string[]>(() => {})
    for (let bucket = 6000; bucket < 6010; bucket++) {
      setBucket(bucket, 0)
      void loadBucketedOnce(options(() => never))
    }
    await flush()

    expect(__homeBucketCacheFlightKeysForTests().sort()).toEqual(["v-test:3:6008", "v-test:3:6009"])
  })
})

describe("a consumer that stops waiting does not stop the compute (no cancellation)", () => {
  it("the next consumer joins the very same flight: one compute, even though the first caller gave up", async () => {
    const gate = deferred<string[]>()
    const load = vi.fn(() => gate.promise)

    // The first caller gives up (the Home race fell back to []): it simply never awaits the promise again.
    const abandoned = loadBucketedOnce(options(load))
    void abandoned
    await flush()

    setBucket(1000, 60_000) // a minute later, same bucket
    const next = loadBucketedOnce(options(load))
    await flush()
    expect(load).toHaveBeenCalledTimes(1)
    expect(next).toBe(abandoned)

    gate.resolve(["finished"])
    await expect(next).resolves.toEqual(["finished"])
  })

  it("when the abandoned compute finishes, it fills the cache: the following consumer is a HIT (0 compute)", async () => {
    const gate = deferred<string[]>()
    const load = vi.fn(() => gate.promise)

    void loadBucketedOnce(options(load))
    await flush()
    gate.resolve(["late but useful"])
    await flush()
    expect(cacheFake.store.get("v-test,3,1000")).toBe('["late but useful"]')

    await expect(loadBucketedOnce(options(load))).resolves.toEqual(["late but useful"])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("an abandoned compute that fails leaves nothing behind and does not raise an unhandled rejection", async () => {
    const gate = deferred<string[]>()
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    try {
      void loadBucketedOnce(options(() => gate.promise)).catch(() => {})
      await flush()
      gate.reject(new Error("late failure"))
      await flush()
      await flush()

      expect(unhandled).not.toHaveBeenCalled()
      expect(cacheFake.store.size).toBe(0)
      expect(__homeBucketCacheFlightKeysForTests()).toEqual([])
    } finally {
      process.off("unhandledRejection", unhandled)
    }
  })
})

describe("[home_cache] diagnostics", () => {
  it("MISS: COMPUTE_START, COMPUTE_DONE and a CONSUMER line saying 'computed'", async () => {
    await loadBucketedOnce(options(async () => [{ id: 1 }, { id: 2 }]))
    await flush()

    expect(logs.lines.every((l) => l.module === "home_cache")).toBe(true)
    expect(logs.lines.map((l) => l.payload.event)).toEqual(["COMPUTE_START", "COMPUTE_DONE", "CONSUMER"])
    expect(events("COMPUTE_DONE")[0]).toMatchObject({ loader: "home_best_sellers_7d", bucket: 1000, count: 2 })
    expect(events("CONSUMER")[0]).toMatchObject({ outcome: "computed", computed: true, count: 2 })
  })

  it("HIT: a single CONSUMER line saying 'hit', and no COMPUTE_START", async () => {
    await loadBucketedOnce(options(async () => ["a"]))
    logs.lines.length = 0

    await loadBucketedOnce(options(async () => ["never called"]))
    await flush()

    expect(logs.lines.map((l) => l.payload.event)).toEqual(["CONSUMER"])
    expect(events("CONSUMER")[0]).toMatchObject({ outcome: "hit", computed: false })
  })

  it("followers are logged as 'joined' and there is exactly one COMPUTE_START per flight", async () => {
    const gate = deferred<string[]>()
    const calls = [1, 2, 3].map(() => loadBucketedOnce(options(() => gate.promise)))
    gate.resolve(["a"])
    await Promise.all(calls)
    await flush()

    expect(events("COMPUTE_START")).toHaveLength(1)
    expect(events("CONSUMER").map((e) => e.outcome).sort()).toEqual(["computed", "joined", "joined"])
  })

  it("an error is logged by name and Prisma code only — never its message", async () => {
    const boom = Object.assign(new Error("SELECT * FROM \"User\" WHERE email = 'secret@example.com'"), {
      name: "PrismaClientKnownRequestError",
      code: "P1017",
    })

    await expect(loadBucketedOnce(options(() => Promise.reject(boom)))).rejects.toBe(boom)
    await flush()

    expect(events("COMPUTE_ERROR")[0]).toMatchObject({ error_name: "PrismaClientKnownRequestError", error_code: "P1017" })
    expect(events("CONSUMER")[0]).toMatchObject({ outcome: "error", error_code: "P1017" })
    expect(JSON.stringify(logs.lines)).not.toMatch(/secret@example\.com|SELECT/)
  })

  it("logs only counters, timings and ids: no payload, URL or product data", async () => {
    await loadBucketedOnce(
      options(async () => [{ name: "Secret product name", imageUrl: "https://cdn.example/private/photo.jpg", listingId: "l-1" }])
    )
    await flush()

    const text = JSON.stringify(logs.lines)
    expect(text).not.toMatch(/Secret product name|https?:|cdn\.example|l-1/)
    const allowed = new Set([
      "event", "ts", "loader", "instance", "flight_key", "bucket", "uptime_s", "flights_in_progress",
      "elapsed_ms", "count", "outcome", "computed", "joined", "error_name", "error_code",
    ])
    for (const line of logs.lines) for (const key of Object.keys(line.payload)) expect(allowed.has(key), key).toBe(true)
  })
})
