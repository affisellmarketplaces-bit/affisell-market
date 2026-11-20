/**
 * Supplier store sync (Shopify / WooCommerce) and the product lifecycle (founder decision 2026-11-18):
 * out of stock never unpublishes; publication is the supplier's choice at import and never rewritten by a later sync;
 * the commission (a commercial condition) is set once at import, never reset.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { upsertSyncedProduct } from "@/lib/supplier-sync/sync-engine"

const m = vi.hoisted(() => ({
  existing: null as null | Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  creates: [] as Record<string, unknown>[],
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findFirst: async () => m.existing,
      update: async (args: { data: Record<string, unknown> }) => {
        m.updates.push(args.data)
        return {}
      },
      create: async (args: { data: Record<string, unknown> }) => {
        m.creates.push(args.data)
        return {}
      },
    },
  },
}))
vi.mock("@/lib/integrations/schema-capabilities", () => ({ productDecoupleFieldsLive: () => false }))

const mapped = (stock: number, contentHash = "h2") =>
  ({
    externalId: "ext-1",
    name: "Lamp",
    description: "d",
    images: [],
    basePriceCents: 1500,
    stock,
    supplierSku: "SKU",
    sourceUrl: "",
    raw: {},
    contentHash,
    categoryLabel: null,
  }) as never

const base = { supplierId: "s1", provider: "SHOPIFY" as never }

describe("upsertSyncedProduct × lifecycle", () => {
  beforeEach(() => {
    m.existing = null
    m.updates.length = 0
    m.creates.length = 0
  })

  it("creation: publication follows the supplier's publishLive choice, even out of stock", async () => {
    await upsertSyncedProduct({ ...base, mapped: mapped(0), publishLive: true })
    expect(m.creates[0]).toMatchObject({ active: true, isDraft: false, stock: 0, commissionRate: 15 })
  })

  it("creation without publishLive stays a draft", async () => {
    await upsertSyncedProduct({ ...base, mapped: mapped(4) })
    expect(m.creates[0]).toMatchObject({ active: false, isDraft: true })
  })

  it("an existing product going out of stock keeps its publication and commercial status", async () => {
    m.existing = { id: "p1", externalContentHash: "h1", active: true, isDraft: false }
    const out = await upsertSyncedProduct({ ...base, mapped: mapped(0, "h1") })
    expect(out.action).toBe("updated")
    expect(m.updates[0]).toMatchObject({ stock: 0 })
    expect(m.updates[0]).not.toHaveProperty("active")
    expect(m.updates[0]).not.toHaveProperty("isDraft")
  })

  it("a content update never rewrites publication, status or commission", async () => {
    m.existing = { id: "p1", externalContentHash: "h1", active: false, isDraft: false }
    await upsertSyncedProduct({ ...base, mapped: mapped(9, "h2"), publishLive: true })
    const data = m.updates[0]!
    expect(data).toMatchObject({ stock: 9, name: "Lamp" })
    for (const key of ["active", "isDraft", "commissionRate"]) expect(data).not.toHaveProperty(key)
  })
})
