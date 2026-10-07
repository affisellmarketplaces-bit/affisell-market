import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  load: vi.fn(),
  txUpdate: vi.fn(),
  txFindUnique: vi.fn(),
  txAttrDeleteMany: vi.fn(),
  txAttrCreateMany: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    product: { update: m.txUpdate, findUnique: m.txFindUnique },
    productAttribute: { deleteMany: m.txAttrDeleteMany, createMany: m.txAttrCreateMany },
  }
  return {
    prisma: {
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
      store: { findUnique: async () => null },
      product: { findUnique: async () => null },
    },
  }
})
vi.mock("@/lib/supplier-product-put-load", () => ({ loadSupplierProductForPut: m.load }))
vi.mock("@/lib/supplier-wholesale-increase-guard.server", async (orig) => ({
  ...(await orig<object>()),
  assertSupplierWholesaleIncreaseAllowed: async () => null,
}))
vi.mock("@/lib/supplier-product-visibility-flags", async (orig) => ({
  ...(await orig<object>()),
  applySupplierProductVisibilityFlags: async () => undefined,
}))
vi.mock("@/lib/merchant-legal/require-merchant-verified", () => ({ requireMerchantVerifiedForPublish: async () => null }))
vi.mock("@/lib/growth/catalog-cap.server", () => ({ assertProductCreationAllowed: async () => ({ allowed: true }) }))
vi.mock("@/lib/category-leaf-guard", () => ({ normalizeLeafCategoryId: async (v: unknown) => (typeof v === "string" ? v : null) }))
vi.mock("@/lib/supplier-invitation", () => ({ onSupplierProductPublishedFromInvite: async () => undefined }))
vi.mock("@/lib/community-new-drop", () => ({ createNewDropCommunityPost: async () => undefined }))
vi.mock("@/lib/product-auto-categorize", () => ({ scheduleProductAutoCategorization: () => undefined }))
vi.mock("@/lib/china-buying/route-china-buy", () => ({ routeChinaBuy: async () => undefined }))
vi.mock("@/lib/revalidate-supplier-shopfront", () => ({ revalidateSupplierShopfront: async () => undefined }))
vi.mock("@/lib/revalidate-listing-card-image", () => ({ revalidateListingCardImagesForProduct: async () => undefined }))
vi.mock("@/lib/affiliate-wholesale-change-notify", () => ({ notifyAffiliatesAfterSupplierProductSave: async () => undefined }))
vi.mock("@/lib/supplier-product-remove.server", () => ({ deleteSupplierProduct: async () => undefined }))
vi.mock("@/lib/booking/slot-availability", () => ({ countAvailableBookingSlots: async () => 1 }))

import { PUT } from "@/app/api/supplier/products/[id]/route"

const GPSR = [
  { key: "gpsr_manufacturer_name", label: "Fabricant", value: "Atelier Dupont SAS" },
  { key: "gpsr_manufacturer_address", label: "Adresse fabricant", value: "12 rue des Lilas, 75011 Paris" },
  { key: "gpsr_manufacturer_email", label: "Email fabricant", value: "contact@dupont.fr" },
  { key: "gpsr_manufacturer_country", label: "Manufacturer country", value: "FR" },
]

function load(over: { isDraft: boolean; attributes?: Array<{ key: string; label: string; value: string }> }) {
  return {
    guard: { listingKind: "PHYSICAL", commissionRate: 15, stock: 3, isDraft: over.isDraft, basePriceCents: 1990 },
    wholesaleBeforeSnapshot: null,
    offerRow: {
      offerMode: "STANDARD", isRefurbished: false, minOrderQuantity: 1, images: ["https://cdn.example.com/a.jpg"],
      warehouseType: "local", shippingCountry: "FR", warehouseCity: null, processingTime: 1, deliveryMin: 2, deliveryMax: 5,
      shippingMethods: [], freeShippingThreshold: null, shippingCost: 0, digitalAccessUrl: null, digitalAccessInstructions: null,
      digitalInstantDelivery: true, bookingDurationMinutes: null, bookingCancellationHours: 24, bookingVenueLabel: null,
      bookingInstantConfirm: true,
    },
    categoryId: "cat_leaf",
    deliveryCountryCodes: ["FR"],
    customColumns: null,
    attributes: over.attributes ?? [],
    listingVariantsJson: null,
    productVariants: [],
  }
}

const body = (over: Record<string, unknown> = {}) => ({
  name: "Lampe en lin",
  description: "Une lampe de chevet en lin lavé, abat-jour amovible.",
  price: 19.9,
  stock: 3,
  commission: 15,
  images: ["https://cdn.example.com/a.jpg"],
  categoryId: "cat_leaf",
  warehouseType: "local",
  deliveryCountryCodes: ["FR"],
  ...over,
})
const put = (b: unknown) =>
  PUT(new Request("http://x/api/supplier/products/p1", { method: "PUT", body: JSON.stringify(b) }), { params: Promise.resolve({ id: "p1" }) })

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined)
  m.auth.mockReset().mockResolvedValue({ user: { id: "sup_1", role: "SUPPLIER" } })
  const row = (isDraft: boolean) => ({ id: "p1", name: "Lampe en lin", isDraft, active: !isDraft, commissionRate: 15, variants: null, basePriceCents: 1990, images: [], categoryId: "cat_leaf" })
  m.txUpdate.mockReset().mockImplementation(async () => row(false))
  m.txFindUnique.mockReset().mockImplementation(async () => row(false))
  m.txAttrDeleteMany.mockReset().mockResolvedValue({ count: 0 })
  m.txAttrCreateMany.mockReset().mockResolvedValue({ count: 0 })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const createdKeys = () => (m.txAttrCreateMany.mock.calls[0]?.[0].data as Array<{ key: string; value: string }> | undefined) ?? []

describe("PUT /api/supplier/products/[id] — listing readiness", () => {
  it("enforce: a draft going live without manufacturer data is refused (422) before anything is written", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    m.load.mockResolvedValue(load({ isDraft: true }))
    const res = await put(body({ publish: true, productAttributes: [] }))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe("listing_not_ready")
    expect(m.txUpdate).not.toHaveBeenCalled()
  })

  it("enforce: counts data already on the product (a guided-wizard draft being published from another screen)", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    m.load.mockResolvedValue(load({ isDraft: true, attributes: GPSR }))
    const res = await put(body({ publish: true })) // no productAttributes key: nothing to replace, the stored data counts
    expect(res.status).toBe(200)
  })

  it("enforce: a draft going live WITH the data publishes", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    m.load.mockResolvedValue(load({ isDraft: true }))
    const res = await put(body({ publish: true, productAttributes: GPSR }))
    expect(res.status).toBe(200)
    expect(createdKeys().map((r) => r.key)).toEqual(expect.arrayContaining(["gpsr_manufacturer_name", "gpsr_manufacturer_country"]))
  })

  it("enforce never blocks the edit of a listing that is already live (legacy listings stay editable)", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    m.load.mockResolvedValue(load({ isDraft: false }))
    const res = await put(body({ price: 24.9, productAttributes: [] }))
    expect(res.status).toBe(200)
    expect(m.txUpdate).toHaveBeenCalledTimes(1)
  })

  it("enforce never evaluates a draft autosave", async () => {
    vi.stubEnv("LISTING_READINESS_MODE", "enforce")
    m.load.mockResolvedValue(load({ isDraft: true }))
    const res = await put(body({ saveAsDraft: true, productAttributes: [] }))
    expect(res.status).toBe(200)
  })

  it("warn (default): publishes a draft without the data, and logs it", async () => {
    m.load.mockResolvedValue(load({ isDraft: true }))
    const res = await put(body({ publish: true, productAttributes: [] }))
    expect(res.status).toBe(200)
    expect(console.log).toHaveBeenCalledWith("[listing-readiness]", expect.objectContaining({ source: "api_update", result: "would_refuse_if_enforced" }))
  })
})

describe("PUT /api/supplier/products/[id] — attributes are no longer wiped by a form that does not know them", () => {
  const existing = [
    { key: "material", label: "Matériau", value: "Coton" },
    { key: "gpsr_manufacturer_name", label: "Fabricant", value: "Atelier Dupont SAS" },
    { key: "brand", label: "Marque", value: "Acme" },
  ]

  it("legacy contract (no managedAttributeKeys): the incoming set replaces everything — unchanged behaviour", async () => {
    m.load.mockResolvedValue(load({ isDraft: false, attributes: existing }))
    await put(body({ productAttributes: [{ key: "brand", label: "Marque", value: "Nova" }] }))
    expect(m.txAttrDeleteMany).toHaveBeenCalledTimes(1)
    expect(createdKeys().map((r) => r.key)).toEqual(["brand"])
  })

  it("with managedAttributeKeys, rows the form does not own are preserved", async () => {
    m.load.mockResolvedValue(load({ isDraft: false, attributes: existing }))
    await put(body({ productAttributes: [{ key: "brand", label: "Marque", value: "Nova" }], managedAttributeKeys: ["brand", "size"] }))
    expect(createdKeys().map((r) => `${r.key}=${r.value}`).sort()).toEqual(["brand=Nova", "gpsr_manufacturer_name=Atelier Dupont SAS", "material=Coton"])
  })

  it("a managed key that is no longer sent is deleted (how a form clears a field)", async () => {
    m.load.mockResolvedValue(load({ isDraft: false, attributes: existing }))
    await put(body({ productAttributes: [], managedAttributeKeys: ["gpsr_manufacturer_name"] }))
    expect(createdKeys().map((r) => r.key).sort()).toEqual(["brand", "material"])
  })

  it("nothing to sync when the merged set equals the stored one", async () => {
    m.load.mockResolvedValue(load({ isDraft: false, attributes: existing }))
    await put(body({ productAttributes: [{ key: "brand", label: "Marque", value: "Acme" }], managedAttributeKeys: ["brand"] }))
    expect(m.txAttrDeleteMany).not.toHaveBeenCalled()
  })

  it("a save that does not send productAttributes leaves them untouched", async () => {
    m.load.mockResolvedValue(load({ isDraft: false, attributes: existing }))
    await put(body({}))
    expect(m.txAttrDeleteMany).not.toHaveBeenCalled()
    expect(m.txAttrCreateMany).not.toHaveBeenCalled()
  })
})
