import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))

const sink = vi.hoisted(() => ({ lines: [] as { module: string; payload: Record<string, unknown> }[] }))
vi.mock("@/lib/business-log", () => ({
  logBusiness: (module: string, payload: Record<string, unknown>) => sink.lines.push({ module, payload }),
}))

import { __resetHomeBucketCacheForTests, loadBucketedOnce } from "@/lib/home-bucket-cache"
import { __resetHomeRaceDiagnosticsForTests, startHomeRace } from "@/lib/home-race-diagnostics"
import {
  __resetPrismaDiagnosticsForTests,
  __setPrismaDiagnosticsEnabledForTests,
  emitDiag,
} from "@/lib/prisma-diagnostics"
import { RUNTIME_INSTANCE_ID } from "@/lib/runtime-instance"

beforeEach(() => {
  sink.lines.length = 0
  __resetHomeBucketCacheForTests()
  __resetHomeRaceDiagnosticsForTests()
  __resetPrismaDiagnosticsForTests()
  __setPrismaDiagnosticsEnabledForTests(true)
})

afterEach(() => {
  __resetPrismaDiagnosticsForTests()
})

describe("shared process id", () => {
  it("looks like a short base-36 token", () => {
    expect(RUNTIME_INSTANCE_ID).toMatch(/^[0-9a-z]{1,6}$/)
  })

  it("is the SAME in [home_race], [home_cache] and [prisma_diag] lines, so one process can be followed across them", async () => {
    const probe = startHomeRace("home_best_sellers_7d", 5_000)
    await probe.watch(Promise.resolve("done"))
    await loadBucketedOnce({ loader: "home_best_sellers_7d", version: "v-test", limit: 3, revalidateSec: 900, tags: [], load: async () => [] })
    emitDiag("RUNTIME_START", { interval_ms: 1_000 })

    const byModule = (name: string) => sink.lines.filter((l) => l.module === name).map((l) => l.payload.instance)
    expect(byModule("home_race").length).toBeGreaterThan(0)
    expect(byModule("home_cache").length).toBeGreaterThan(0)
    expect(byModule("prisma_diag").length).toBeGreaterThan(0)
    expect(new Set([...byModule("home_race"), ...byModule("home_cache"), ...byModule("prisma_diag")])).toEqual(new Set([RUNTIME_INSTANCE_ID]))
  })

  it("survives a module reload in the same process (duplicated bundles share it through globalThis)", async () => {
    vi.resetModules()
    const again = await import("@/lib/runtime-instance")
    expect(again.RUNTIME_INSTANCE_ID).toBe(RUNTIME_INSTANCE_ID)
    expect((globalThis as Record<symbol, { id: string }>)[Symbol.for("affisell.runtime.instance")]?.id).toBe(RUNTIME_INSTANCE_ID)
  })
})
