/**
 * The auto-order engine routes a line to a SOURCING channel (real money spent on an external site) only while the
 * single external-purchase switch is on — even for a supplier holding an explicit authorisation. Off: the line falls
 * back to the native/manual path, exactly as for an unauthorised supplier.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveFulfillmentChannel } from "@/lib/auto-order/resolve-channel"

const { upserts } = vi.hoisted(() => ({ upserts: [] as string[] }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fulfillmentProvider: {
      findFirst: async () => ({ id: "prov-ae", channelType: "ALIEXPRESS" }),
      upsert: async (args: { where: { slug: string } }) => {
        upserts.push(args.where.slug)
        return { id: `id-${args.where.slug}` }
      },
    },
    blindDropshipSupplier: { findUnique: async () => null },
    supplierLink: { findUnique: async () => ({ isActive: true, autoBuyEnabled: true, aeProductId: "1005" }) },
  },
}))

vi.mock("@/lib/supplier-auto-buy-authorization.server", () => ({
  channelRequiresAuthorization: (channel: string) => channel === "ALIEXPRESS" || channel === "CJ_DROPSHIPPING",
  isSupplierAuthorizedForChannel: async () => true,
}))


const product = {
  id: "p1",
  supplierId: "s1",
  autoFulfill: true,
  fulfillmentChannel: "ALIEXPRESS" as const,
  importSource: "aliexpress",
  aliexpressProductId: "1005",
  supplierSku: null,
  supplierWholesaleCents: 500,
}

describe("resolveFulfillmentChannel × external-purchase switch", () => {
  beforeEach(() => {
    upserts.length = 0
    vi.stubEnv("AUTO_ORDER_ENABLED", "")
    vi.stubEnv("DISABLE_AUTO_BUY", "")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("switch off (default): an authorised supplier still falls back to the native path", async () => {
    vi.stubEnv("AUTO_BUY_ENABLED", "")
    const resolved = await resolveFulfillmentChannel(product as never)
    expect(resolved?.channel).toBe("AFFISELL_NATIVE")
    expect(upserts).toContain("native-s1")
  })

  it("switch on: the authorised sourcing channel is used", async () => {
    vi.stubEnv("AUTO_BUY_ENABLED", "true")
    const resolved = await resolveFulfillmentChannel(product as never)
    expect(resolved).toEqual({ channel: "ALIEXPRESS", providerId: "prov-ae" })
  })

  it("autoFulfill off: nothing is routed, whatever the switch", async () => {
    vi.stubEnv("AUTO_BUY_ENABLED", "true")
    expect(await resolveFulfillmentChannel({ ...product, autoFulfill: false } as never)).toBeNull()
  })
})
