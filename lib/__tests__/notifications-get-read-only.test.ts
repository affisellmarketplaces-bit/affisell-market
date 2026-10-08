/**
 * GUARD — the notification / supplier-orders GET handlers are READ-ONLY.
 *
 * Why: until 2026-10 these handlers awaited (supplier) or floated (affiliate) a business catch-up on every poll:
 * Stripe retrieve + fulfilment, amount reconciliation, notification heal/refresh and a "legacy reopen" transaction.
 * On a cold serverless instance that took far longer than the 10 s API budget, so 96 % of cold supplier polls
 * returned 504 and the floating affiliate work left Prisma transactions open until they expired.
 *
 * Three layers, each of which would have caught the original code:
 *   1. behaviour — each GET answers while every catch-up dependency is replaced by a spy that hangs forever;
 *   2. static, GET bodies — no write / Stripe / fulfilment / heal / after() / floating-promise tokens;
 *   3. static, import graph — nothing a GET route reaches (static or dynamic import) can run a catch-up.
 */
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const ROOT = path.resolve(__dirname, "../..")

// ─────────────────────────────── 1. behaviour ───────────────────────────────

const h = vi.hoisted(() => {
  /** A catch-up dependency that, if it were awaited, would never let the request finish. */
  const hang = () => new Promise<never>(() => {})
  const spy = () => vi.fn(hang)
  return {
    auth: vi.fn(),
    // reads
    notificationFindMany: vi.fn(),
    orderFindMany: vi.fn(),
    orderCount: vi.fn(),
    blindSupplierFindUnique: vi.fn(),
    blindOrderCount: vi.fn(),
    fetchSupplierOrders: vi.fn(),
    // writes (must never be reached by a GET)
    notificationUpdate: vi.fn(),
    notificationUpdateMany: vi.fn(),
    notificationCreate: vi.fn(),
    orderUpdate: vi.fn(),
    orderUpdateMany: vi.fn(),
    transaction: vi.fn(),
    executeRaw: vi.fn(),
    // catch-up dependencies (must never be reached by a GET)
    syncBeforeInbox: spy(),
    syncBeforeInboxIfDue: spy(),
    healRecent: spy(),
    healOrder: spy(),
    reconcilePartnerPending: spy(),
    reconcileAmounts: spy(),
    ensureFulfilled: spy(),
    fulfillSession: spy(),
    getStripeClient: vi.fn(() => {
      throw new Error("Stripe must not be touched by a GET")
    }),
    dispatchAlerts: spy(),
    runAfterResponse: spy(),
    reopenLegacy: spy(),
    reopenLegacyIfDue: spy(),
  }
})

vi.mock("@/auth", () => ({ auth: h.auth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: h.notificationFindMany,
      update: h.notificationUpdate,
      updateMany: h.notificationUpdateMany,
      create: h.notificationCreate,
    },
    order: {
      findMany: h.orderFindMany,
      count: h.orderCount,
      update: h.orderUpdate,
      updateMany: h.orderUpdateMany,
    },
    blindDropshipSupplier: { findUnique: h.blindSupplierFindUnique },
    blindDropshipOrder: { count: h.blindOrderCount, findMany: vi.fn(async () => []) },
    $transaction: h.transaction,
    $executeRaw: h.executeRaw,
    $executeRawUnsafe: h.executeRaw,
  },
}))

vi.mock("@/lib/supplier-orders-payload", () => ({ fetchSupplierOrders: h.fetchSupplierOrders }))

vi.mock("@/lib/marketplace-order-notification-sync", () => ({
  syncPartnerMarketplaceAlertsBeforeInbox: h.syncBeforeInbox,
  syncPartnerMarketplaceAlertsBeforeInboxIfDue: h.syncBeforeInboxIfDue,
  resetPartnerMarketplaceAlertSyncThrottleForTests: vi.fn(),
  PARTNER_MARKETPLACE_ALERT_SYNC_MIN_INTERVAL_MS: 60_000,
}))

vi.mock("@/lib/marketplace-order-notification-heal", async (importOriginal) => {
  // Keep the one PURE helper the affiliate read path legitimately imports; spy on everything that heals.
  const actual = await importOriginal<typeof import("@/lib/marketplace-order-notification-heal")>()
  return {
    ...actual,
    healRecentPartnerMarketplaceNotifications: h.healRecent,
    healMarketplaceOrderNotifications: h.healOrder,
  }
})

vi.mock("@/lib/cron/reconcile-partner-pending-checkouts", () => ({
  reconcilePartnerPendingCheckoutOrders: h.reconcilePartnerPending,
}))
vi.mock("@/lib/marketplace-order-settlement-reconcile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketplace-order-settlement-reconcile")>()
  return { ...actual, reconcileMarketplaceOrderPartnerAmounts: h.reconcileAmounts }
})
vi.mock("@/lib/marketplace-checkout-fulfill", () => ({ ensureMarketplaceCheckoutFulfilled: h.ensureFulfilled }))
vi.mock("@/lib/stripe-marketplace-fulfill", () => ({ fulfillMarketplaceStripeSession: h.fulfillSession }))
vi.mock("@/lib/stripe", () => ({ getStripeClient: h.getStripeClient }))
vi.mock("@/lib/emails/dispatch-merchant-order-alerts", () => ({ dispatchMerchantOrderAlerts: h.dispatchAlerts }))
vi.mock("@/lib/after-response", () => ({ runAfterResponse: h.runAfterResponse }))
vi.mock("@/lib/supplier-order-alert-inbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supplier-order-alert-inbox")>()
  return {
    ...actual,
    reopenLegacySupplierToShipAlerts: h.reopenLegacy,
    reopenLegacySupplierToShipAlertsIfDue: h.reopenLegacyIfDue,
  }
})

const CATCH_UP_SPIES = [
  "syncBeforeInbox",
  "syncBeforeInboxIfDue",
  "healRecent",
  "healOrder",
  "reconcilePartnerPending",
  "reconcileAmounts",
  "ensureFulfilled",
  "fulfillSession",
  "getStripeClient",
  "dispatchAlerts",
  "runAfterResponse",
  "reopenLegacy",
  "reopenLegacyIfDue",
] as const

const WRITE_SPIES = [
  "notificationUpdate",
  "notificationUpdateMany",
  "notificationCreate",
  "orderUpdate",
  "orderUpdateMany",
  "transaction",
  "executeRaw",
] as const

function expectNoCatchUpAndNoWrites() {
  for (const name of CATCH_UP_SPIES) {
    expect(h[name], `catch-up dependency "${name}" must not be called by a GET`).not.toHaveBeenCalled()
  }
  for (const name of WRITE_SPIES) {
    expect(h[name], `write "${name}" must not be reached by a GET`).not.toHaveBeenCalled()
  }
}

/** Resolves when `p` settles, rejects if it does not within `ms` — proves the GET does not wait on anything hung. */
async function settlesWithin<T>(p: Promise<T>, ms = 2_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`GET did not answer within ${ms} ms`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Lets any floating promise / microtask chain a handler might have started run to its first await. */
async function flushBackgroundWork() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve))
}

function resetMocks() {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { id: "sup_1", role: "SUPPLIER" } })
  h.notificationFindMany.mockResolvedValue([
    {
      id: "n1",
      userId: "sup_1",
      type: "NEW_ORDER",
      message: "New order",
      imageUrl: null,
      orderId: "ord_1",
      read: false,
      createdAt: new Date("2026-10-08T00:00:00Z"),
    },
  ])
  h.orderFindMany.mockResolvedValue([])
  h.orderCount.mockResolvedValue(1)
  h.blindSupplierFindUnique.mockResolvedValue(null)
  h.blindOrderCount.mockResolvedValue(0)
  h.fetchSupplierOrders.mockResolvedValue([])
}

describe("GET /api/supplier/notifications — read-only", () => {
  beforeEach(resetMocks)

  it.each([
    ["a normal poll", "http://localhost/api/supplier/notifications"],
    ["the bell being opened (?sync=1)", "http://localhost/api/supplier/notifications?sync=1"],
  ])("answers from the inbox with no catch-up and no write — %s", async (_label, url) => {
    const { GET } = await import("@/app/api/supplier/notifications/route")

    const res = await settlesWithin(GET(new Request(url)))
    await flushBackgroundWork()

    expect(res.status).toBe(200)
    const body = (await res.json()) as { notifications: Array<{ id: string }>; unreadCount: number }
    expect(body.notifications.map((n) => n.id)).toEqual(["n1"])
    expect(body.unreadCount).toBe(1)
    // (1)-(4): no blocking sync, no Stripe, no fulfilment, no heal — and nothing implicit in the background either.
    expectNoCatchUpAndNoWrites()
  })

  it("never refreshes or heals implicitly, whatever the query string", async () => {
    const { GET } = await import("@/app/api/supplier/notifications/route")
    for (const qs of ["", "?sync=1", "?sync=0", "?refresh=1", "?force=1"]) {
      await settlesWithin(GET(new Request(`http://localhost/api/supplier/notifications${qs}`)))
    }
    await flushBackgroundWork()
    expect(h.healRecent).not.toHaveBeenCalled()
    expect(h.healOrder).not.toHaveBeenCalled()
    expect(h.syncBeforeInbox).not.toHaveBeenCalled()
    expect(h.syncBeforeInboxIfDue).not.toHaveBeenCalled()
  })

  it("does not reopen the legacy alerts implicitly (no read→unread flip, no order flag write)", async () => {
    const { GET } = await import("@/app/api/supplier/notifications/route")
    await settlesWithin(GET(new Request("http://localhost/api/supplier/notifications?sync=1")))
    await flushBackgroundWork()
    expect(h.reopenLegacy).not.toHaveBeenCalled()
    expect(h.reopenLegacyIfDue).not.toHaveBeenCalled()
    expect(h.notificationUpdateMany).not.toHaveBeenCalled()
    expect(h.orderUpdateMany).not.toHaveBeenCalled()
    expect(h.transaction).not.toHaveBeenCalled()
  })

  it("keeps the auth and role gates", async () => {
    const { GET } = await import("@/app/api/supplier/notifications/route")
    h.auth.mockResolvedValueOnce(null)
    expect((await GET(new Request("http://localhost/api/supplier/notifications"))).status).toBe(401)
    h.auth.mockResolvedValueOnce({ user: { id: "aff_1", role: "AFFILIATE" } })
    expect((await GET(new Request("http://localhost/api/supplier/notifications"))).status).toBe(403)
    expect(h.notificationFindMany).not.toHaveBeenCalled()
  })
})

describe("GET /api/supplier/orders — read-only", () => {
  beforeEach(resetMocks)

  it("returns the orders without any blocking synchronisation", async () => {
    const { GET } = await import("@/app/api/supplier/orders/route")

    const res = await settlesWithin(GET(new Request("http://localhost/api/supplier/orders?tab=to_ship")))
    await flushBackgroundWork()

    expect(res.status).toBe(200)
    const body = (await res.json()) as { orders: unknown[]; tab: string }
    expect(body.tab).toBe("to_ship")
    expect(body.orders).toEqual([])
    expect(h.fetchSupplierOrders).toHaveBeenCalledWith("sup_1", "to_ship")
    expectNoCatchUpAndNoWrites()
  })
})

describe("GET /api/affiliate/notifications — read-only, no floating work", () => {
  beforeEach(() => {
    resetMocks()
    h.auth.mockResolvedValue({ user: { id: "aff_1", role: "AFFILIATE" } })
    h.notificationFindMany.mockResolvedValue([])
  })

  it("answers from the inbox and starts nothing in the background (`?sync=1` is accepted and ignored)", async () => {
    const { GET } = await import("@/app/api/affiliate/notifications/route")

    const res = await settlesWithin(GET())
    await flushBackgroundWork()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ unreadCount: 0, notifications: [] })
    // No floating `void (async …)()`, and no after()-style background task either: the read starts no work at all.
    expectNoCatchUpAndNoWrites()
  })

  it("responds even when the old background catch-up would never finish", async () => {
    const { loadAffiliateNotificationInbox } = await import("@/lib/affiliate-notification-inbox")
    const payload = await settlesWithin(loadAffiliateNotificationInbox("aff_1"))
    await flushBackgroundWork()
    expect(payload).toEqual({ unreadCount: 0, notifications: [] })
    expect(h.syncBeforeInboxIfDue).not.toHaveBeenCalled()
  })
})

// ───────────────────────── 2 + 3. static guards ─────────────────────────

/** Code that can WRITE, call Stripe, fulfil, heal or start background work. */
const FORBIDDEN_SYMBOLS = [
  "syncPartnerMarketplaceAlertsBeforeInbox",
  "syncPartnerMarketplaceAlertsBeforeInboxIfDue",
  "healRecentPartnerMarketplaceNotifications",
  "healMarketplaceOrderNotifications",
  "reconcilePartnerPendingCheckoutOrders",
  "reconcilePendingCheckoutOrders",
  "reconcileMarketplaceOrderPartnerAmounts",
  "ensureMarketplaceCheckoutFulfilled",
  "fulfillMarketplaceStripeSession",
  "dispatchMerchantOrderAlerts",
  "scheduleMarketplaceTransferAttempts",
  "getStripeClient",
  "reopenLegacySupplierToShipAlerts",
  "reopenLegacySupplierToShipAlertsIfDue",
  "runAfterResponse",
] as const

const abs = (rel: string) => path.join(ROOT, rel)

/**
 * Modules that DEFINE catch-up code. A GET route may reach one only to import the listed pure helper, and the walk
 * never descends into them (they are leaves).
 */
const CATCH_UP_MODULES: Record<string, readonly string[]> = {
  [abs("lib/marketplace-order-notification-sync.ts")]: [],
  [abs("lib/marketplace-order-notification-heal.ts")]: ["affiliateNotificationSettlementFromOrder"],
  [abs("lib/cron/reconcile-partner-pending-checkouts.ts")]: [],
  [abs("lib/cron/reconcile-pending-checkout-orders.ts")]: [],
  [abs("lib/marketplace-checkout-fulfill.ts")]: [],
  [abs("lib/stripe-marketplace-fulfill.ts")]: [],
  [abs("lib/marketplace-order-settlement-reconcile.ts")]: [],
  [abs("lib/emails/dispatch-merchant-order-alerts.ts")]: [],
  [abs("lib/transfers/schedule-from-checkout.ts")]: [],
  [abs("lib/after-response.ts")]: [],
  [abs("lib/stripe.ts")]: [],
}

/** Shared modules the walk does not descend into (their own graph is out of scope for this guard). */
const NOT_DESCENDED = new Set([abs("auth.ts"), abs("lib/prisma.ts")])

/** Code only: the guards must not trip on comments that explain the old behaviour. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
}

type ImportRef = { spec: string; names: string[]; dynamic: boolean }

function parseNamedClause(clause: string): string[] {
  const braces = clause.match(/\{([^}]*)\}/)
  const names: string[] = []
  if (braces) {
    for (const part of braces[1].split(",")) {
      const p = part.trim()
      if (!p || /^type\s/.test(p)) continue
      names.push(p.split(/\s+as\s+/)[0].trim())
    }
  }
  const outside = clause.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim()
  if (outside) names.push(outside.startsWith("*") ? "*" : "default")
  return names
}

/** Value imports only (`import type …` and `{ type X }` are erased at build time). */
function extractImports(src: string): ImportRef[] {
  const code = stripComments(src)
  const refs: ImportRef[] = []
  for (const m of code.matchAll(/(^|\n)\s*import\s+(type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']/g)) {
    if (m[2]) continue
    refs.push({ spec: m[4], names: parseNamedClause(m[3]), dynamic: false })
  }
  for (const m of code.matchAll(/(^|\n)\s*import\s+["']([^"']+)["']/g)) {
    refs.push({ spec: m[2], names: [], dynamic: false })
  }
  for (const m of code.matchAll(/\{([^}]*)\}\s*=\s*await\s+import\(\s*["']([^"']+)["']\s*\)/g)) {
    refs.push({ spec: m[2], names: parseNamedClause(`{${m[1]}}`), dynamic: true })
  }
  for (const m of code.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
    refs.push({ spec: m[1], names: ["*"], dynamic: true })
  }
  return refs
}

function resolveModule(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith("./") || spec.startsWith("../")) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** Violations found in ONE source text; `resolved` maps each import to its file so the walker can reuse this. */
function violationsInSource(src: string, fromFile: string): { violations: string[]; descend: string[] } {
  const violations: string[] = []
  const descend: string[] = []
  const rel = path.relative(ROOT, fromFile)
  for (const ref of extractImports(src)) {
    const resolved = resolveModule(ref.spec, fromFile)
    const forbiddenNames = ref.names.filter((n) => (FORBIDDEN_SYMBOLS as readonly string[]).includes(n))
    const allowed = resolved ? CATCH_UP_MODULES[resolved] : undefined

    if (allowed) {
      const illegal = ref.names.filter((n) => !allowed.includes(n))
      if (ref.dynamic || ref.names.length === 0 || illegal.length > 0) {
        violations.push(
          `${rel} ${ref.dynamic ? "dynamically " : ""}imports ${
            illegal.length ? illegal.join(", ") : "(whole module)"
          } from ${path.relative(ROOT, resolved!)}`
        )
      }
      continue // leaf: a catch-up module is never descended into
    }
    if (forbiddenNames.length > 0) {
      violations.push(`${rel} imports ${forbiddenNames.join(", ")} from ${ref.spec}`)
    }
    if (resolved && !NOT_DESCENDED.has(resolved)) descend.push(resolved)
  }
  return { violations, descend }
}

function reachableViolations(roots: string[]): { violations: string[]; visited: string[] } {
  const visited = new Set<string>()
  const violations: string[] = []
  const queue = [...roots]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (visited.has(file)) continue
    visited.add(file)
    const found = violationsInSource(readFileSync(file, "utf8"), file)
    violations.push(...found.violations)
    queue.push(...found.descend)
  }
  return { violations, visited: [...visited].map((f) => path.relative(ROOT, f)) }
}

/** The text of `export async function GET …` only (the same files also export PATCH handlers, which legitimately write). */
function getHandlerSource(file: string): string {
  const src = readFileSync(file, "utf8")
  const start = src.indexOf("export async function GET")
  expect(start, `${path.relative(ROOT, file)} must export a GET handler`).toBeGreaterThanOrEqual(0)
  const rest = src.slice(start + 1)
  const next = rest.search(/\n(export |const patchSchema)/)
  return stripComments(next === -1 ? src.slice(start) : src.slice(start, start + 1 + next))
}

const GET_ROUTES = [
  "app/api/supplier/notifications/route.ts",
  "app/api/supplier/orders/route.ts",
  "app/api/affiliate/notifications/route.ts",
].map(abs)

const FORBIDDEN_IN_GET_BODY: Array<[RegExp, string]> = [
  [/\$transaction/, "a Prisma transaction"],
  [/\$executeRaw|\$queryRawUnsafe/, "raw SQL"],
  [/\.(update|updateMany|create|createMany|upsert|delete|deleteMany)\s*\(/, "a Prisma write"],
  [/stripe/i, "Stripe"],
  [/ensure\w*Fulfil|fulfillMarketplace|triggerAuto\w*Fulfil|autoFulfil/i, "fulfilment"],
  [/\bheal/i, "a notification heal"],
  [/reconcile/i, "a reconcile"],
  [/\bsync[A-Z(]|syncPartner/, "a synchronisation"],
  [/reopenLegacy/, "the legacy reopen"],
  [/runAfterResponse|\bafter\s*\(|waitUntil/, "background work"],
  [/void\s*\(\s*async|void\s+\(?\s*async|void\s+[A-Za-z_.]+\(/, "a floating promise"],
]

describe("notification GET routes — static guard", () => {
  it.each(GET_ROUTES.map((f) => [path.relative(ROOT, f), f]))(
    "%s: the GET body has no write / Stripe / fulfilment / heal / background token",
    (_rel, file) => {
      const body = getHandlerSource(file)
      for (const [pattern, what] of FORBIDDEN_IN_GET_BODY) {
        expect(pattern.test(body), `${path.relative(ROOT, file)} GET must not contain ${what}`).toBe(false)
      }
    }
  )

  it("nothing a GET notification route reaches can run a catch-up (imports + dynamic imports, transitively)", () => {
    const { violations, visited } = reachableViolations([...GET_ROUTES, abs("lib/affiliate-notification-inbox.ts")])
    expect(violations).toEqual([])
    // The walk really covered the read path (a vacuous guard would pass with an empty graph).
    expect(visited).toEqual(
      expect.arrayContaining([
        "app/api/supplier/notifications/route.ts",
        "app/api/supplier/orders/route.ts",
        "app/api/affiliate/notifications/route.ts",
        "lib/affiliate-notification-inbox.ts",
        "lib/supplier-order-alert-inbox.ts",
        "lib/merchant-notification-order-summary.ts",
      ])
    )
  })

  it("the affiliate inbox reader starts no work: no floating promise, no after(), no sync import", () => {
    const src = stripComments(readFileSync(abs("lib/affiliate-notification-inbox.ts"), "utf8"))
    expect(src).not.toMatch(/void\s*\(\s*async/)
    expect(src).not.toMatch(/runAfterResponse|waitUntil|\bafter\s*\(/)
    expect(src).not.toMatch(/marketplace-order-notification-sync/)
    expect(src).not.toMatch(/scheduleAffiliateMarketplaceAlertSync/)
  })

  it("the supplier notifications route no longer imports the legacy reopen", () => {
    const src = stripComments(readFileSync(abs("app/api/supplier/notifications/route.ts"), "utf8"))
    expect(src).not.toMatch(/reopenLegacy/)
  })

  it("the guard itself detects the pre-fix code (it is not vacuous)", () => {
    const supplierBefore = `
      import { auth } from "@/auth"
      import { reopenLegacySupplierToShipAlertsIfDue } from "@/lib/supplier-order-alert-inbox"
      export async function GET() {
        const { syncPartnerMarketplaceAlertsBeforeInboxIfDue } = await import(
          "@/lib/marketplace-order-notification-sync"
        )
        await syncPartnerMarketplaceAlertsBeforeInboxIfDue({ supplierId: "x" }, { force: true })
        await reopenLegacySupplierToShipAlertsIfDue("x")
      }`
    const found = violationsInSource(supplierBefore, abs("app/api/supplier/notifications/route.ts")).violations
    expect(found.join("\n")).toMatch(/syncPartnerMarketplaceAlertsBeforeInboxIfDue/)
    expect(found.join("\n")).toMatch(/reopenLegacySupplierToShipAlertsIfDue/)

    const affiliateBefore = `
      export function schedule() {
        void (async () => {
          const { syncPartnerMarketplaceAlertsBeforeInboxIfDue } = await import("@/lib/marketplace-order-notification-sync")
          await syncPartnerMarketplaceAlertsBeforeInboxIfDue({ affiliateId: "a" })
        })()
      }`
    expect(violationsInSource(affiliateBefore, abs("lib/affiliate-notification-inbox.ts")).violations).not.toEqual([])
    expect(/void\s*\(\s*async/.test(affiliateBefore)).toBe(true)

    const ordersBefore = `
      import { syncPartnerMarketplaceAlertsBeforeInbox } from "@/lib/marketplace-order-notification-sync"
      export async function GET() { await syncPartnerMarketplaceAlertsBeforeInbox({ supplierId: "x" }) }`
    expect(violationsInSource(ordersBefore, abs("app/api/supplier/orders/route.ts")).violations).not.toEqual([])
    expect(FORBIDDEN_IN_GET_BODY.some(([p]) => p.test("await syncPartnerMarketplaceAlertsBeforeInbox({"))).toBe(true)
  })
})
