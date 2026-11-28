import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * No payment for a line that cannot ship. The server gate decides from the SAME read-only resolution the fulfilment
 * engine uses, so checkout and fulfilment cannot disagree; native products are never blocked; a mixed cart is refused
 * whole; an unknown fulfilment path is refused; and every product payment path calls the gate before Stripe.
 */
type World = {
  product: Record<string, unknown> | null
  providerByChannel?: Record<string, { id: string; channelType: string; paymentMethod: string }>
  providerBySlug?: Record<string, { id: string; paymentMethod: string }>
  blind?: { id: string; isBlindDropship: boolean; apiType: string } | null
  authorized?: string[]
  qcPassed?: boolean
  throwOnProduct?: boolean
}
let world: World
const products: Record<string, World> = {}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const w = products[where.id]
        if (w?.throwOnProduct) throw new Error("db down")
        world = w ?? { product: null }
        return w?.product ?? null
      },
    },
    fulfillmentProvider: {
      findFirst: async ({ where }: { where: { channelType: string } }) =>
        world.providerByChannel?.[where.channelType] ?? null,
      findUnique: async ({ where }: { where: { slug: string } }) => world.providerBySlug?.[where.slug] ?? null,
      upsert: async () => {
        throw new Error("checkout must never write a provider")
      },
    },
    blindDropshipSupplier: { findUnique: async () => world.blind ?? null },
    supplierLink: {
      findUnique: async () => (world.product as { supplierLink?: unknown } | null)?.supplierLink ?? null,
    },
    supplierAutoBuyAuthorization: {
      findUnique: async ({ where }: { where: { supplierId_channelType: { channelType: string } } }) =>
        world.authorized?.includes(where.supplierId_channelType.channelType) ? { revokedAt: null } : null,
    },
    agentMission: { count: async () => (world.qcPassed ? 1 : 0) },
  },
}))

const { assertCheckoutDeliverable, loadPurchaseDependencies } = await import("@/lib/checkout/deliverability.server")
const { checkoutDeliverabilityMode, decideCheckoutDeliverability, decideLineDeliverability } =
  await import("@/lib/checkout/deliverability")

const base = {
  supplierId: "sup_1",
  autoFulfill: true,
  autoBuyEnabled: false,
  fulfillmentChannel: null,
  importSource: null,
  aliexpressProductId: null,
  supplierSku: null,
  supplierWholesaleCents: null,
  chinaBuyingAgentId: null,
  sourceUrl: null,
  supplierLink: null,
}
const add = (id: string, product: Record<string, unknown>, extra: Partial<World> = {}) => {
  products[id] = { product: { id, ...base, ...product }, ...extra }
}

beforeEach(() => {
  for (const k of Object.keys(products)) delete products[k]
  add("p_native", {})
  add("p_autobuy", { supplierLink: { isActive: true, autoBuyEnabled: true, aeProductId: "1005" } })
  add(
    "p_ae_import_authorized",
    { importSource: "aliexpress", aliexpressProductId: "1005" },
    { authorized: ["ALIEXPRESS"] },
  )
  add("p_ae_import_not_authorized", { importSource: "aliexpress", aliexpressProductId: "1005" }, { authorized: [] })
  add(
    "p_cj_wallet",
    { fulfillmentChannel: "CJ_DROPSHIPPING" },
    {
      providerByChannel: {
        CJ_DROPSHIPPING: { id: "prov_cj", channelType: "CJ_DROPSHIPPING", paymentMethod: "WALLET_PREPAID" },
      },
      authorized: ["CJ_DROPSHIPPING"],
    },
  )
  add("p_blind", { supplierSku: "SKU1" }, { blind: { id: "b1", isBlindDropship: true, apiType: "rest" } })
  add(
    "p_china",
    { autoBuyEnabled: true, chinaBuyingAgentId: "superbuy", sourceUrl: "https://1688.test/x" },
    { qcPassed: true },
  )
  add("p_autofulfill_off", { autoFulfill: false })
  products.p_broken = { product: null, throwOnProduct: true }
})
afterEach(() => vi.unstubAllEnvs())

describe("which purchases a paid order would trigger (same rules as the purchase paths)", () => {
  it.each([
    ["p_native", []],
    ["p_autofulfill_off", []],
    ["p_autobuy", ["aliexpress/auto_buy"]],
    ["p_ae_import_authorized", ["aliexpress/engine"]],
    ["p_ae_import_not_authorized", []], // engine falls back to the supplier itself: NOT blocked (no false positive)
    ["p_cj_wallet", ["cj/engine", "supplier_payment/engine_payment"]],
    ["p_blind", ["partner_rest/engine", "supplier_payment/engine_payment"]],
  ])("%s → %j", async (id, want) => {
    const deps = await loadPurchaseDependencies(id)
    expect(deps?.map((d) => `${d.channel}/${d.via}`)).toEqual(want)
  })

  it("China agent: only when its API is configured (otherwise a manual route the supplier handles)", async () => {
    expect((await loadPurchaseDependencies("p_china"))?.map((d) => d.channel)).toEqual([])
    vi.stubEnv("SUPERBUY_API_KEY", "k")
    expect((await loadPurchaseDependencies("p_china"))?.map((d) => d.channel)).toEqual(["china_agent"])
  })

  it("a lookup failure is unknown, never 'deliverable'", async () => {
    expect(await loadPurchaseDependencies("p_broken")).toBeNull()
    expect(await loadPurchaseDependencies("p_missing")).toBeNull()
  })
})

describe("decisions (pure)", () => {
  const ON = {
    SUPPLIER_PURCHASES_ENABLED: "true",
    SUPPLIER_PURCHASE_DAILY_LIMITS:
      "aliexpress=unlimited,cj=unlimited,partner_rest=unlimited,china_agent=unlimited,supplier_payment=unlimited",
    SUPPLIER_PURCHASE_CHANNELS: "aliexpress",
  }
  it("no dependency → deliverable even with every channel closed", () => {
    expect(decideLineDeliverability([], {}).deliverable).toBe(true)
  })
  it("a closed channel → not deliverable, naming it; open → deliverable", () => {
    const deps = [{ channel: "aliexpress" as const, via: "auto_buy" as const }]
    expect(decideLineDeliverability(deps, {})).toMatchObject({
      deliverable: false,
      reason: "supplier_channel_closed",
      closedChannels: ["aliexpress"],
    })
    expect(decideLineDeliverability(deps, ON).deliverable).toBe(true)
  })
  it("payment channel closed while the purchase channel is open → still refused", () => {
    const deps = [
      { channel: "cj" as const, via: "engine" as const },
      { channel: "supplier_payment" as const, via: "engine_payment" as const },
    ]
    expect(
      decideLineDeliverability(deps, {
        SUPPLIER_PURCHASES_ENABLED: "true",
        SUPPLIER_PURCHASE_DAILY_LIMITS:
          "aliexpress=unlimited,cj=unlimited,partner_rest=unlimited,china_agent=unlimited,supplier_payment=unlimited",
        SUPPLIER_PURCHASE_CHANNELS: "cj",
      }),
    ).toMatchObject({
      deliverable: false,
      closedChannels: ["supplier_payment"],
    })
  })
  it("daily quota: used up, or unreadable → closed for checkout; below it, or unlimited → open", () => {
    const deps = [{ channel: "cj" as const, via: "engine" as const }]
    const env = {
      SUPPLIER_PURCHASES_ENABLED: "true",
      SUPPLIER_PURCHASE_CHANNELS: "cj",
      SUPPLIER_PURCHASE_DAILY_LIMITS: "cj=3",
    }
    expect(decideLineDeliverability(deps, env, { cj: 2 }).deliverable).toBe(true)
    expect(decideLineDeliverability(deps, env, { cj: 3 })).toMatchObject({ deliverable: false, closedChannels: ["cj"] })
    expect(decideLineDeliverability(deps, env, {})).toMatchObject({ deliverable: false, closedChannels: ["cj"] })
    expect(
      decideLineDeliverability(deps, { ...env, SUPPLIER_PURCHASE_DAILY_LIMITS: "cj=unlimited" }, {}).deliverable,
    ).toBe(true)
  })
  it("unknown → refused", () => {
    expect(decideLineDeliverability(null, ON)).toMatchObject({ deliverable: false, reason: "fulfillment_unknown" })
  })
  it("mode: default and anything unrecognised = enforce; warn / off explicit", () => {
    expect(checkoutDeliverabilityMode(undefined)).toBe("enforce")
    expect(checkoutDeliverabilityMode("Off")).toBe("enforce")
    expect(checkoutDeliverabilityMode("warn")).toBe("warn")
    expect(checkoutDeliverabilityMode("off")).toBe("off")
  })
  it("mixed cart: one bad line refuses the whole payment (never half-charged)", () => {
    const good = { productId: "a", verdict: decideLineDeliverability([], {}) }
    const bad = { productId: "b", verdict: decideLineDeliverability([{ channel: "aliexpress", via: "auto_buy" }], {}) }
    expect(decideCheckoutDeliverability([good, bad], "enforce")).toMatchObject({
      ok: false,
      blocked: [{ productId: "b" }],
    })
    expect(decideCheckoutDeliverability([good, bad], "warn")).toMatchObject({
      ok: true,
      warnings: [{ productId: "b" }],
    })
    expect(decideCheckoutDeliverability([good], "enforce")).toEqual({ ok: true, warnings: [] })
  })
})

describe("the server gate (what every payment path calls)", () => {
  it("default env: a native-only cart passes", async () => {
    expect(await assertCheckoutDeliverable("cart", [{ productId: "p_native", ref: "l_native" }])).toBeNull()
  })

  it("default env: a mixed cart is refused with a 409 naming ONLY the bad lines, by the ids the client sent", async () => {
    const res = await assertCheckoutDeliverable("cart", [
      { productId: "p_native", ref: "l_native" },
      { productId: "p_autobuy", ref: "l_autobuy" },
      { productId: "p_cj_wallet", ref: "l_third" },
    ])
    expect(res?.status).toBe(409)
    const body = await res!.json()
    expect(body.error).toBe("PRODUCT_TEMPORARILY_UNAVAILABLE")
    expect(body.unavailableProductIds).toEqual(["l_autobuy", "l_third"])
    expect(JSON.stringify(body)).not.toMatch(/aliexpress|cj|supplier_payment|SUPPLIER_PURCHASE/) // no internals leaked
  })

  it("the same product twice in a cart is resolved once and flagged on both lines", async () => {
    const res = await assertCheckoutDeliverable("cart", [
      { productId: "p_autobuy", ref: "l1" },
      { productId: "p_autobuy", ref: "l2" },
    ])
    expect((await res!.json()).unavailableProductIds).toEqual(["l1", "l2"])
  })

  it("channel open → the same cart passes; closing it again (between two checks) refuses again", async () => {
    vi.stubEnv("SUPPLIER_PURCHASES_ENABLED", "true")
    vi.stubEnv("SUPPLIER_PURCHASE_CHANNELS", "aliexpress")
    vi.stubEnv(
      "SUPPLIER_PURCHASE_DAILY_LIMITS",
      "aliexpress=unlimited,cj=unlimited,partner_rest=unlimited,china_agent=unlimited,supplier_payment=unlimited",
    )
    expect(await assertCheckoutDeliverable("cart", [{ productId: "p_autobuy", ref: "l" }])).toBeNull()
    vi.stubEnv("SUPPLIER_PURCHASE_CHANNELS", "cj")
    vi.stubEnv(
      "SUPPLIER_PURCHASE_DAILY_LIMITS",
      "aliexpress=unlimited,cj=unlimited,partner_rest=unlimited,china_agent=unlimited,supplier_payment=unlimited",
    )
    expect((await assertCheckoutDeliverable("cart", [{ productId: "p_autobuy", ref: "l" }]))?.status).toBe(409)
  })

  it("lookup failure → refused (fail-closed), warn → passes and logs, off → passes", async () => {
    expect((await assertCheckoutDeliverable("cart", [{ productId: "p_broken", ref: "l" }]))?.status).toBe(409)
    vi.stubEnv("CHECKOUT_DELIVERABILITY_MODE", "warn")
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    expect(await assertCheckoutDeliverable("cart", [{ productId: "p_autobuy", ref: "l" }])).toBeNull()
    expect(log.mock.calls.some((c) => JSON.stringify(c).includes("would_refuse_if_enforced"))).toBe(true)
    log.mockRestore()
    vi.stubEnv("CHECKOUT_DELIVERABILITY_MODE", "off")
    expect(await assertCheckoutDeliverable("cart", [{ productId: "p_autobuy", ref: "l" }])).toBeNull()
  })

  it("blind dropship always needs the partner channel, even for a product with no other dependency", async () => {
    const res = await assertCheckoutDeliverable(
      "blind_dropship",
      [{ productId: "p_native", ref: "l" }],
      [{ channel: "partner_rest", via: "blind_dropship" }],
    )
    expect(res?.status).toBe(409)
  })
})

describe("no product payment path can skip the gate (source scan)", () => {
  const ROOTS = ["lib", "app"]
  const walk = (d: string, out: string[] = []): string[] => {
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e === "__tests__" || e.startsWith(".")) continue
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(ts|tsx)$/.test(e) && !/\.test\./.test(e)) out.push(p)
    }
    return out
  }
  // The only exemptions: payments for Affisell's own services (subscriptions, an ad placement) — no physical product,
  // nothing to buy from a supplier. Each is pinned to what proves it.
  const EXEMPT: Record<string, RegExp> = {
    "app/api/stripe/create-checkout/route.ts": /mode:\s*"subscription"/,
    "app/api/stripe/create-growth-checkout/route.ts": /mode:\s*"subscription"/,
    "app/api/stripe/create-radar-checkout/route.ts": /mode:\s*"subscription"/,
    "app/api/sponsor/checkout/route.ts": /Affisell Promote/,
  }
  const SUBSCRIPTION_ONLY = new Set(Object.keys(EXEMPT))
  const files = ROOTS.flatMap((r) => walk(r)).filter((f) =>
    /checkout\.sessions\.create\(|paymentIntents\.create\(/.test(readFileSync(f, "utf8")),
  )

  it("finds the payment creators", () => {
    expect(files.length).toBeGreaterThanOrEqual(8)
  })

  it.each(files.filter((f) => !SUBSCRIPTION_ONLY.has(f)))(
    "%s calls assertCheckoutDeliverable BEFORE creating the payment",
    (f) => {
      const src = readFileSync(f, "utf8")
      const gate = src.indexOf("await assertCheckoutDeliverable(")
      const pay = Math.min(
        ...[src.indexOf("checkout.sessions.create("), src.indexOf("paymentIntents.create(")].filter((i) => i >= 0),
      )
      expect(gate, f).toBeGreaterThan(0)
      // every payment creation in the file comes after a gate call
      for (const m of src.matchAll(/checkout\.sessions\.create\(|paymentIntents\.create\(/g)) {
        const before = src.slice(0, m.index)
        expect(before.lastIndexOf("await assertCheckoutDeliverable("), `${f} @${m.index}`).toBeGreaterThan(-1)
      }
      expect(gate).toBeLessThan(pay)
    },
  )

  it("the exempt files really sell an Affisell service, not a product line", () => {
    for (const [f, proof] of Object.entries(EXEMPT)) {
      const src = readFileSync(f, "utf8")
      expect(src, f).toMatch(proof)
      expect(src, f).not.toMatch(/sellingPriceCents|loadListing|supplierWholesale/) // never charges a product line
    }
  })
})

describe("blind dropship is gated on its partner channel (source pin)", () => {
  it("the blind checkout passes partner_rest as an extra dependency", () => {
    const src = readFileSync("lib/blind-dropship-checkout.ts", "utf8")
    expect(src).toMatch(/assertCheckoutDeliverable\([\s\S]{0,300}\{ channel: "partner_rest", via: "blind_dropship" \}/)
  })
})

describe("payment after a channel closed (the window between check and payment)", () => {
  it("the engine flags the paid order MANUAL_REQUIRED instead of leaving it 'in progress' (source pin)", () => {
    const src = readFileSync("lib/auto-order/engine.ts", "utf8")
    expect(src).toContain('logAutoOrder("paid_order_not_purchasable"')
    expect(src.indexOf('fulfillmentStatus: "MANUAL_REQUIRED"')).toBeGreaterThan(0)
  })
})

describe("GET /api/checkout/deliverability (advisory, read-only)", () => {
  it("returns only the listing ids that cannot be paid; empty for bad input; never internals", async () => {
    const { prisma } = (await import("@/lib/prisma")) as unknown as { prisma: Record<string, unknown> }
    prisma.affiliateProduct = {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id, productId: id === "l_native" ? "p_native" : "p_autobuy" })),
    }
    const { GET } = await import("@/app/api/checkout/deliverability/route")
    const res = await GET(new Request("http://x/api/checkout/deliverability?ids=l_native,l_ae"))
    const body = await res.json()
    expect(body).toEqual({ unavailableProductIds: ["l_ae"] })
    expect(await (await GET(new Request("http://x/api/checkout/deliverability"))).json()).toEqual({
      unavailableProductIds: [],
    })
    vi.stubEnv("CHECKOUT_DELIVERABILITY_MODE", "warn")
    expect(await (await GET(new Request("http://x/api/checkout/deliverability?ids=l_ae"))).json()).toEqual({
      unavailableProductIds: [],
    })
  })
})
