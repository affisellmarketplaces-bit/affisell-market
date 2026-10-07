import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  txProductCreate: vi.fn(),
  txAttrCreateMany: vi.fn(),
  storeFindUnique: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/prisma", () => {
  const tx = { product: { create: m.txProductCreate }, productAttribute: { createMany: m.txAttrCreateMany } }
  return {
    prisma: {
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
      store: { findUnique: m.storeFindUnique },
    },
  }
})
vi.mock("@/lib/merchant-legal/require-merchant-verified", () => ({ merchantVerificationGate: async () => ({ allowed: true }) }))
vi.mock("@/lib/growth/catalog-cap.server", () => ({ assertProductCreationAllowed: async () => ({ allowed: true }) }))
vi.mock("@/lib/category-leaf-guard", () => ({ normalizeLeafCategoryId: async () => "cat_leaf" }))
vi.mock("@/lib/category-attribute-rules", () => ({
  CategoryAttributeValidationError: class extends Error {},
  normalizeCategoryAttributeValues: () => ({}),
  validateVisibleCategoryAttributes: async () => undefined,
}))
vi.mock("@/lib/community-new-drop", () => ({ createNewDropCommunityPost: async () => undefined }))
vi.mock("@/lib/supplier-invitation", () => ({ onSupplierProductPublishedFromInvite: async () => undefined }))
vi.mock("@/lib/revalidate-supplier-shopfront", () => ({ revalidateSupplierShopfront: async () => undefined }))
vi.mock("@/lib/product-auto-categorize", () => ({ scheduleProductAutoCategorization: () => undefined }))
vi.mock("@/lib/china-buying/route-china-buy", () => ({ routeChinaBuy: async () => undefined }))
vi.mock("@/lib/supplier-product-is-draft-fallback", () => ({ findSupplierProductsForOwnerApi: async () => [] }))

import { POST } from "@/app/api/supplier/products/route"

const GPSR = [
  { key: "gpsr_manufacturer_name", label: "Manufacturer", value: "Atelier Dupont SAS" },
  { key: "gpsr_manufacturer_address", label: "Manufacturer address", value: "12 rue des Lilas, 75011 Paris" },
  { key: "gpsr_manufacturer_email", label: "Manufacturer email", value: "contact@dupont.fr" },
  { key: "gpsr_manufacturer_country", label: "Manufacturer country", value: "FR" },
]

const payload = (over: Record<string, unknown> = {}) => ({
  name: "Lampe en lin",
  description: "Une lampe de chevet en lin lavé, abat-jour amovible.",
  price: 19.9,
  stock: 3,
  commission: 15,
  listingKind: "PHYSICAL",
  images: ["https://cdn.example.com/a.jpg"],
  categoryId: "cat_leaf",
  warehouseType: "local",
  shippingCountry: "FR",
  deliveryCountryCodes: ["FR"],
  productAttributes: [],
  ...over,
})
const post = (body: unknown) => POST(new Request("http://x/api/supplier/products", { method: "POST", body: JSON.stringify(body) }))

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined)
  m.auth.mockReset().mockResolvedValue({ user: { id: "sup_1", role: "SUPPLIER" } })
  m.txProductCreate.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "prod_1", name: data.name, commissionRate: 15, variants: null, basePriceCents: 1990, images: data.images,
  }))
  m.txAttrCreateMany.mockReset().mockResolvedValue({ count: 0 })
  m.storeFindUnique.mockReset().mockResolvedValue(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("POST /api/supplier/products — listing readiness", () => {
  it("default (warn): publishes a product with no manufacturer data, exactly as before", async () => {
    const res = await post(payload())
    expect(res.status).toBe(201)
    expect(m.txProductCreate).toHaveBeenCalledTimes(1)
  })

  it("enforce: refuses a new physical publication with 422 + codes, BEFORE anything is written", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    const res = await post(payload())
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("listing_not_ready")
    expect(body.issues.map((i: { code: string }) => i.code)).toEqual(
      expect.arrayContaining(["gpsr_manufacturer_name_missing", "gpsr_manufacturer_country_missing"])
    )
    expect(m.txProductCreate).not.toHaveBeenCalled()
    expect(m.txAttrCreateMany).not.toHaveBeenCalled()
  })

  it("enforce: a complete EU manufacturer publishes and its data is stored as attributes", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    const res = await post(payload({ productAttributes: GPSR }))
    expect(res.status).toBe(201)
    const stored = m.txAttrCreateMany.mock.calls[0]![0].data.map((a: { key: string }) => a.key)
    expect(stored).toEqual(expect.arrayContaining(["gpsr_manufacturer_name", "gpsr_manufacturer_country"]))
  })

  it("enforce: a manufacturer outside the EU needs an EU responsible person", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    const cn = GPSR.map((r) => (r.key === "gpsr_manufacturer_country" ? { ...r, value: "CN" } : r))
    const res = await post(payload({ productAttributes: cn }))
    expect(res.status).toBe(422)
    expect((await res.json()).issues.map((i: { code: string }) => i.code)).toContain("gpsr_eu_rep_name_missing")
  })

  it("enforce never blocks a DRAFT (nothing goes live)", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    const res = await post(payload({ saveAsDraft: true, name: "", images: [], categoryId: "" }))
    expect(res.status).toBe(201)
  })

  it("enforce never blocks digital goods (not product-safety scope)", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    const res = await post(
      payload({ listingKind: "SOFTWARE", digitalAccessUrl: "https://example.com/access", digitalInstantDelivery: true })
    )
    expect(res.status).not.toBe(422)
  })

  it("off: nothing is evaluated", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "off")
    expect((await post(payload())).status).toBe(201)
    expect(console.log).not.toHaveBeenCalledWith("[listing-readiness]", expect.anything())
  })

  it("warn logs what WOULD have been refused, for the rollout decision", async () => {
    await post(payload())
    expect(console.log).toHaveBeenCalledWith(
      "[listing-readiness]",
      expect.objectContaining({ source: "api_create", result: "would_refuse_if_enforced", supplierId: "sup_1" })
    )
  })
})
