import "server-only"

import { unstable_cache } from "next/cache"

import { logBusiness } from "@/lib/business-log"

/**
 * Bucketed cache + local single-flight for a Home loader (Lot 1A).
 *
 * WHAT IT IS
 *  - The cache key carries a 300 s time bucket, so every instance reads/writes the same entry for 5 minutes and a new
 *    entry starts at each bucket boundary. `revalidate` (> bucket length) is only an expiry: inside its own bucket an
 *    entry is never stale, so there is no background regeneration to leak out of a request.
 *  - Next's `unstable_cache` does NOT de-duplicate concurrent misses (N parallel calls = N loader runs). The single-flight
 *    here does it, per instance: the first caller starts the read-through, everyone else in the same bucket awaits the
 *    SAME promise.
 *
 * WHAT IT IS NOT (read before changing it)
 *  - Not a cancellation. A caller that stops waiting (the Home race timeout) leaves the promise running: JS promises
 *    cannot be cancelled and Prisma exposes no abort here. The render stopping, the promise settling and the SQL
 *    statement ending are three different events; nothing in this file claims otherwise.
 *  - Not protection against instance suspension. A flight that was running when the instance froze stays "in flight"
 *    until its promise settles; there is deliberately NO age-based takeover (at thaw every flight looks old, and starting
 *    a second compute exactly when the first one is about to fail with P1017 only adds load). The next bucket simply
 *    starts its own flight, so a stuck one can block its own bucket only — at most 2 concurrent computes per loader.
 *  - Not shared across instances: two instances can still compute the same bucket once each.
 *
 * CONTRACT FOR CALLERS
 *  - `load` MUST throw on failure. `unstable_cache` never stores a thrown error, whereas a "Safe" loader that returns `[]`
 *    on failure would have that `[]` cached for the whole TTL. A legitimate empty result IS cached.
 *  - Never call this from inside another `unstable_cache` callback: nested calls bypass the cache entirely.
 *
 * Logs `[home_cache]`: loader, instance, flight key, bucket, timings, counters, `error.name` and a Prisma code only —
 * never an error message (it can embed query text), a URL or a payload.
 */

export const HOME_CACHE_LOG_MODULE = "home_cache"
export const HOME_CACHE_BUCKET_MS = 300_000

/** One id per process (serverless instance), to tell instances apart and group the flights of one instance. */
const INSTANCE_ID = Math.random().toString(36).slice(2, 8)

type Fields = Record<string, string | number | boolean | undefined>
type Flight = { bucket: number; state: { computed: boolean }; promise: Promise<unknown> }

/** Flights in progress in THIS process, by `version:limit:bucket`. */
const flights = new Map<string, Flight>()

export function homeCacheBucket(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / HOME_CACHE_BUCKET_MS)
}

export function homeBucketKeyParts(version: string, limit: number, bucket: number): string[] {
  return [version, String(limit), String(bucket)]
}

function emit(event: string, fields: Fields): void {
  try {
    logBusiness(HOME_CACHE_LOG_MODULE, {
      event,
      ts: new Date().toISOString(),
      ...fields,
      uptime_s: typeof process !== "undefined" && typeof process.uptime === "function" ? Math.round(process.uptime()) : undefined,
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

function countOf(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined
}

/** Memory hygiene only: a flight of an older bucket can no longer be joined (the key changed) and ends on its own. */
function dropFlightsOlderThan(oldestBucketKept: number): void {
  for (const [key, flight] of flights) if (flight.bucket < oldestBucketKept) flights.delete(key)
}

export type BucketedLoadOptions<T> = {
  /** Log label, e.g. "home_best_sellers_7d". */
  loader: string
  /** Cache version: change it to abandon every stored entry at once. */
  version: string
  limit: number
  /** `unstable_cache` expiry in seconds. Keep it above the bucket length so an entry is never stale inside its bucket. */
  revalidateSec: number
  tags: string[]
  /** The loader that THROWS on failure (never a "Safe" variant). */
  load: () => Promise<T>
  /** Tests only. */
  nowMs?: number
}

export function loadBucketedOnce<T>(options: BucketedLoadOptions<T>): Promise<T> {
  const { loader, version, limit, revalidateSec, tags, load } = options
  const consumerStartedAt = Date.now()
  const bucket = homeCacheBucket(options.nowMs ?? consumerStartedAt)
  const keyParts = homeBucketKeyParts(version, limit, bucket)
  const flightKey = keyParts.join(":")
  const base: Fields = { loader, instance: INSTANCE_ID, flight_key: flightKey, bucket }

  dropFlightsOlderThan(bucket - 1)

  const consume = (flight: Flight, joined: boolean): void => {
    void flight.promise.then(
      (value) =>
        emit("CONSUMER", {
          ...base,
          outcome: joined ? "joined" : flight.state.computed ? "computed" : "hit",
          computed: flight.state.computed,
          elapsed_ms: Date.now() - consumerStartedAt,
          count: countOf(value),
        }),
      (error: unknown) =>
        emit("CONSUMER", {
          ...base,
          outcome: "error",
          computed: flight.state.computed,
          joined,
          elapsed_ms: Date.now() - consumerStartedAt,
          ...describeError(error),
        })
    )
  }

  const existing = flights.get(flightKey)
  if (existing) {
    consume(existing, true)
    return existing.promise as Promise<T>
  }

  const state = { computed: false }
  // Runs only on a cache MISS (a HIT never calls it): this is the only place where the database is reached.
  const compute = async (): Promise<T> => {
    state.computed = true
    const startedAt = Date.now()
    emit("COMPUTE_START", { ...base, flights_in_progress: flights.size })
    try {
      const value = await load()
      emit("COMPUTE_DONE", { ...base, elapsed_ms: Date.now() - startedAt, count: countOf(value) })
      return value
    } catch (error) {
      emit("COMPUTE_ERROR", { ...base, elapsed_ms: Date.now() - startedAt, ...describeError(error) })
      throw error
    }
  }
  const promise = (async () => unstable_cache(compute, keyParts, { revalidate: revalidateSec, tags })())()
  const flight: Flight = { bucket, state, promise }
  flights.set(flightKey, flight)

  // Identity check: only the flight that registered the key may clear it, never a newer one that reused the key.
  const release = (): void => {
    if (flights.get(flightKey) === flight) flights.delete(flightKey)
  }
  void promise.then(release, release)

  consume(flight, false)
  return promise
}

/** @internal tests only */
export function __homeBucketCacheFlightKeysForTests(): string[] {
  return [...flights.keys()]
}

/** @internal tests only */
export function __resetHomeBucketCacheForTests(): void {
  flights.clear()
}
