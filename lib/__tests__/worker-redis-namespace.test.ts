import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

import { diagnoseRedisNamespace } from "@/lib/redis-namespace"
import { reportWorkerRedisNamespace, workerNamespaceAlertText } from "@/lib/worker-redis-namespace"

describe("diagnoseRedisNamespace", () => {
  it("production: empty namespace, BullMQ's default prefix, not flagged", () => {
    const d = diagnoseRedisNamespace({ VERCEL_ENV: "production", NODE_ENV: "production" })
    expect(d).toMatchObject({ namespace: "", label: "production", bullmqPrefix: "bull", explicit: false, notExplicitlyChosen: false, environment: "production" })
  })

  it("a worker host with NODE_ENV=production is production too (no VERCEL_ENV)", () => {
    expect(diagnoseRedisNamespace({ NODE_ENV: "production" })).toMatchObject({ bullmqPrefix: "bull", notExplicitlyChosen: false })
  })

  it("THE TRAP: a worker host with neither NODE_ENV=production nor an explicit namespace resolves to dev:bull, and that is flagged", () => {
    for (const env of [{}, { NODE_ENV: "development" }, { REDIS_URL: "rediss://not-a-real-host" }]) {
      expect(diagnoseRedisNamespace(env)).toMatchObject({ namespace: "dev", label: "dev", bullmqPrefix: "dev:bull", explicit: false, notExplicitlyChosen: true })
    }
  })

  it("an explicit production namespace fixes the host (and is not flagged)", () => {
    expect(diagnoseRedisNamespace({ AFFISELL_REDIS_NAMESPACE: "production" })).toMatchObject({
      namespace: "",
      bullmqPrefix: "bull",
      explicit: true,
      notExplicitlyChosen: false,
    })
  })

  it("an explicit non-production namespace is a CHOICE, not flagged (a worker serving Preview's queues)", () => {
    expect(diagnoseRedisNamespace({ AFFISELL_REDIS_NAMESPACE: "preview" })).toMatchObject({
      namespace: "preview",
      bullmqPrefix: "preview:bull",
      explicit: true,
      notExplicitlyChosen: false,
    })
  })

  it("an INVALID explicit value is ignored by the namespace, so it is not a choice: still flagged", () => {
    expect(diagnoseRedisNamespace({ AFFISELL_REDIS_NAMESPACE: "bad value*" })).toMatchObject({ namespace: "dev", explicit: false, notExplicitlyChosen: true })
  })

  it("on a Vercel Preview the 'production' value is ignored: derived namespace, not explicit", () => {
    expect(diagnoseRedisNamespace({ VERCEL_ENV: "preview", AFFISELL_REDIS_NAMESPACE: "production" })).toMatchObject({
      namespace: "preview",
      explicit: false,
      notExplicitlyChosen: true,
    })
  })
})

describe("reportWorkerRedisNamespace", () => {
  let info: MockInstance
  let error: MockInstance
  let exit: MockInstance<typeof process.exit>

  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("production: ONE info line with the namespace, no error, no alert", async () => {
    const alert = vi.fn(async (_text: string) => true)
    const report = await reportWorkerRedisNamespace("auto-order-worker", { env: { NODE_ENV: "production" }, alert })

    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith("[auto-order-worker] redis_namespace", {
      namespace: "production",
      bullmqPrefix: "bull",
      environment: "production",
      explicit: false,
    })
    expect(error).not.toHaveBeenCalled()
    expect(alert).not.toHaveBeenCalled()
    expect(report.alerted).toBe(false)
  })

  it("explicit AFFISELL_REDIS_NAMESPACE=production on a host without NODE_ENV: info only, no alert", async () => {
    const alert = vi.fn(async (_text: string) => true)
    await reportWorkerRedisNamespace("auto-order-worker", { env: { AFFISELL_REDIS_NAMESPACE: "production" }, alert })
    expect(error).not.toHaveBeenCalled()
    expect(alert).not.toHaveBeenCalled()
    expect(info.mock.calls[0]?.[1]).toMatchObject({ namespace: "production", bullmqPrefix: "bull", explicit: true })
  })

  it("explicit AFFISELL_REDIS_NAMESPACE=preview: a choice, info only", async () => {
    const alert = vi.fn(async (_text: string) => true)
    await reportWorkerRedisNamespace("auto-order-worker", { env: { AFFISELL_REDIS_NAMESPACE: "preview" }, alert })
    expect(error).not.toHaveBeenCalled()
    expect(alert).not.toHaveBeenCalled()
  })

  it("THE TRAP: no NODE_ENV, no explicit namespace → info line says dev:bull, an ERROR line, and ONE ops alert — and the process is NOT exited", async () => {
    const alert = vi.fn(async (_text: string) => true)
    const report = await reportWorkerRedisNamespace("auto-order-worker", { env: {}, alert })

    expect(info.mock.calls[0]?.[1]).toMatchObject({ namespace: "dev", bullmqPrefix: "dev:bull", explicit: false })
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]?.[0]).toBe("[auto-order-worker] redis_namespace_not_production")
    expect(alert).toHaveBeenCalledTimes(1)
    const text = String(alert.mock.calls[0]?.[0])
    expect(text).toContain("dev:bull")
    expect(text).toContain("NODE_ENV=production")
    expect(text).toContain("AFFISELL_REDIS_NAMESPACE=production")
    expect(text).toContain("bull") // what Vercel Production uses
    expect(report.alerted).toBe(true)
    expect(report.notExplicitlyChosen).toBe(true)
    expect(exit).not.toHaveBeenCalled() // a visible alert beats a crash loop
  })

  it("the default alert path is the ops webhook (Slack / Discord)", async () => {
    vi.resetModules()
    const opsWebhookAlert = vi.fn(async (_text: string) => ({ slack: true, discord: false }))
    vi.doMock("@/lib/ops-webhook", () => ({ opsWebhookAlert }))
    try {
      const { reportWorkerRedisNamespace: report } = await import("@/lib/worker-redis-namespace")
      await report("auto-order-worker", { env: {} })
      expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
      expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain("dev:bull")
    } finally {
      vi.doUnmock("@/lib/ops-webhook")
      vi.resetModules()
    }
  })

  it("never throws and never blocks the start: a failing alert is logged, a hanging alert times out", async () => {
    const failing = await reportWorkerRedisNamespace("auto-order-worker", {
      env: {},
      alert: async () => {
        throw new Error("slack is down")
      },
    })
    expect(failing.alerted).toBe(false)
    expect(error.mock.calls.map((c) => c[0])).toContain("[auto-order-worker] redis_namespace_alert_failed")

    vi.useFakeTimers()
    const pending = reportWorkerRedisNamespace("auto-order-worker", { env: {}, alert: () => new Promise(() => undefined), alertTimeoutMs: 1_000 })
    await vi.advanceTimersByTimeAsync(1_001)
    await expect(pending).resolves.toMatchObject({ notExplicitlyChosen: true })
  })

  it("never throws whatever the environment object looks like", async () => {
    const hostile = new Proxy({}, { get: () => { throw new Error("boom") } }) as Record<string, string | undefined>
    const report = await reportWorkerRedisNamespace("auto-order-worker", { env: hostile })
    expect(report.alerted).toBe(false)
    expect(error.mock.calls.map((c) => c[0])).toContain("[auto-order-worker] redis_namespace_report_failed")
    expect(exit).not.toHaveBeenCalled()
  })

  it("NO secret in any log line or in the alert: names, namespaces and static text only", async () => {
    const SECRET = "SENTINEL_SECRET_VALUE_zzzzzzzzzz"
    const alert = vi.fn(async (_text: string) => true)
    await reportWorkerRedisNamespace("auto-order-worker", {
      env: {
        REDIS_URL: `rediss://default:${SECRET}@redis.example.test:6379`,
        DATABASE_URL: `postgresql://u:${SECRET}@ep-x.example.test/db`,
        STRIPE_SECRET_KEY: SECRET,
        SLACK_WEBHOOK_URL: `https://hooks.example.test/${SECRET}`,
        AFFISELL_REDIS_NAMESPACE: "   ",
      },
      alert,
    })
    const everything = JSON.stringify([info.mock.calls, error.mock.calls, alert.mock.calls])
    expect(everything).not.toContain(SECRET)
    expect(everything).not.toMatch(/rediss?:\/\/|postgresql:\/\/|hooks\.example/)
  })

  it("the alert text names both fixes and says that a developer machine can ignore it", () => {
    const text = workerNamespaceAlertText("w", diagnoseRedisNamespace({}))
    expect(text).toMatch(/NODE_ENV=production/)
    expect(text).toMatch(/AFFISELL_REDIS_NAMESPACE=production/)
    expect(text).toMatch(/poste de développement/)
  })
})

describe("wiring — every BullMQ worker host reports its namespace before it starts consuming", () => {
  const root = process.cwd()
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

  it("workers/auto-order-worker.ts calls it after the REDIS_URL check and BEFORE the first create*Worker()", () => {
    const source = strip(readFileSync(join(root, "workers/auto-order-worker.ts"), "utf8"))
    const report = source.indexOf('reportWorkerRedisNamespace("auto-order-worker")')
    expect(report).toBeGreaterThan(0)
    expect(report).toBeGreaterThan(source.indexOf("getRedisUrl()"))
    expect(report).toBeLessThan(source.indexOf("createPlaceSupplierOrderWorker()"))
    expect(source.slice(report - 6, report)).toContain("await ")
  })

  it("no file starts a BullMQ worker (create*Worker()) without reporting — a new worker host must do the same", () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next" || entry === "__tests__" || entry.startsWith(".")) continue
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path, out)
        else if (/\.(ts|tsx|mjs)$/.test(entry) && !/\.test\./.test(entry)) out.push(path)
      }
      return out
    }
    const callers = ["lib", "app", "workers", "inngest", "scripts"]
      .flatMap((dir) => walk(join(root, dir)))
      .filter((file) => /\bcreate(?:PlaceSupplierOrder|BatchFulfill|AutoBuy|OrderPaid)Worker\(\)/.test(strip(readFileSync(file, "utf8"))))
    const startsWorkers = callers.filter((file) => !/function create/.test(strip(readFileSync(file, "utf8"))))
    expect(startsWorkers.map((f) => relative(root, f))).toEqual(["workers/auto-order-worker.ts"])
    for (const file of startsWorkers) expect(strip(readFileSync(file, "utf8")), file).toContain("reportWorkerRedisNamespace(")
  })

  it("lib/worker-redis-namespace.ts imports nothing server-only, no Prisma, no Redis client (a worker reports before it connects to anything)", () => {
    const source = readFileSync(join(root, "lib/worker-redis-namespace.ts"), "utf8")
    const imports = [...source.matchAll(/^import[^\n]*?from "([^"]+)"/gm)].map((m) => m[1])
    expect(imports).toEqual(["@/lib/redis-namespace"])
    expect(strip(source)).not.toMatch(/exit\(/) // it never exits the process
  })
})
