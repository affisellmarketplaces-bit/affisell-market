import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyResellerImportReview } from "@/lib/reseller-import/review.server"

const m = vi.hoisted(() => ({
  product: null as null | Record<string, unknown>,
  requests: [] as { payload: unknown }[],
  productUpdates: [] as Record<string, unknown>[],
  listingUpdates: [] as { where: Record<string, unknown>; data: Record<string, unknown> }[],
  audits: [] as Record<string, unknown>[],
}))

vi.mock("@/lib/prisma", () => {
  const tx = {
    product: {
      update: async (a: { data: Record<string, unknown> }) => {
        m.productUpdates.push(a.data)
        return {}
      },
    },
    affiliateProduct: {
      updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        m.listingUpdates.push(a)
        return { count: 2 }
      },
    },
    auditLog: {
      create: async (a: { data: Record<string, unknown> }) => {
        m.audits.push(a.data)
        return {}
      },
    },
  }
  return {
    prisma: {
      product: { findUnique: async () => m.product },
      auditLog: {
        findMany: async (a?: { where?: { action?: string } }) =>
          a?.where?.action === "reseller_import.reviewed" ? [] : m.requests,
      },
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  }
})

const base = { productId: "p1", note: "checked the sheet", adminId: "admin1" }

describe("applyResellerImportReview", () => {
  beforeEach(() => {
    m.product = {
      id: "p1",
      supplierId: "vault",
      importSource: "reseller_url_import",
      tags: ["reseller-import", "import-review:pending"],
      listingKind: "DIGITAL",
      attributes: [],
    }
    m.requests = [
      { payload: { affiliateProductId: "l1", listRequested: true } },
      { payload: { affiliateProductId: "l2", listRequested: false } },
    ]
    m.productUpdates.length = 0
    m.listingUpdates.length = 0
    m.audits.length = 0
  })

  it("approve publishes and lists only the listings whose reseller asked to go live", async () => {
    const out = await applyResellerImportReview({ ...base, decision: "approve" })
    expect(out).toMatchObject({ ok: true, state: "approved" })
    expect(m.productUpdates[0]).toMatchObject({ active: true, isDraft: false, tags: ["reseller-import", "import-review:approved"] })
    expect(m.listingUpdates[0]!.where).toMatchObject({ id: { in: ["l1"] } })
    expect(m.audits[0]).toMatchObject({ action: "reseller_import.reviewed", actorId: "admin1" })
  })

  it("reject keeps it a draft and unlists every listing", async () => {
    const out = await applyResellerImportReview({ ...base, decision: "reject" })
    expect(out).toMatchObject({ ok: true, state: "rejected" })
    expect(m.productUpdates[0]).toMatchObject({ active: false, isDraft: true })
    expect(m.listingUpdates[0]!.data).toEqual({ isListed: false })
  })

  it("an approval never bypasses blocking safety data — even in observation mode the product stays a draft", async () => {
    for (const mode of ["warn", "enforce", "off"]) {
      vi.stubEnv("LISTING_READINESS_MODE", mode)
      m.productUpdates.length = 0
      m.listingUpdates.length = 0
      m.product = { ...m.product!, listingKind: "PHYSICAL", tags: ["import-review:pending"], active: false, isDraft: true }
      const out = await applyResellerImportReview({ ...base, decision: "approve" })
      expect(out).toMatchObject({ ok: true, state: "approved", published: false, listedListings: 0 })
      expect(out.ok && out.blocking.length).toBeGreaterThan(0)
      expect(m.productUpdates[0]).toEqual({ tags: ["import-review:approved"] })
      expect(m.listingUpdates).toHaveLength(0)
    }
    vi.unstubAllEnvs()
  })

  it("approving a legacy product that is already live does not change its publication (founder decision)", async () => {
    m.product = { ...m.product!, listingKind: "PHYSICAL", tags: [], active: true, isDraft: false }
    const out = await applyResellerImportReview({ ...base, decision: "approve" })
    expect(out).toMatchObject({ ok: true, published: true, blocking: [] })
    expect(m.productUpdates[0]).toEqual({ tags: ["import-review:approved"] })
    expect(m.audits.at(-1)).toMatchObject({ payload: expect.objectContaining({ alreadyLive: true }) })
  })

  it("publishApprovedResellerImport re-judges compliance and refuses an incomplete sheet", async () => {
    const { publishApprovedResellerImport } = await import("@/lib/reseller-import/review.server")
    m.product = { ...m.product!, listingKind: "PHYSICAL", tags: ["import-review:approved"], active: false, isDraft: true }
    const refused = await publishApprovedResellerImport({ productId: "p1", adminId: "admin1", note: "ok" })
    expect(refused).toMatchObject({ ok: false, error: "compliance_blocking" })
    m.product = { ...m.product!, listingKind: "DIGITAL" }
    m.productUpdates.length = 0
    expect(await publishApprovedResellerImport({ productId: "p1", adminId: "admin1", note: "ok" })).toEqual({ ok: true, listedListings: 2 })
    expect(m.productUpdates[0]).toEqual({ active: true, isDraft: false })
    m.product = { ...m.product!, tags: ["import-review:pending"] }
    expect(await publishApprovedResellerImport({ productId: "p1", adminId: "admin1", note: "ok" })).toMatchObject({ ok: false, error: "not_approved" })
  })

  it("refuses a product that is not a reseller import, and invalid transitions", async () => {
    m.product = { ...m.product!, importSource: "manual", tags: [] }
    expect(await applyResellerImportReview({ ...base, decision: "approve" })).toEqual({ ok: false, error: "not_a_reseller_import" })
    m.product = { ...m.product!, importSource: "reseller_url_import", tags: ["import-review:approved"] }
    expect(await applyResellerImportReview({ ...base, decision: "approve" })).toEqual({ ok: false, error: "transition_not_allowed" })
  })

  it("a legacy import (no review tag) can be reviewed", async () => {
    m.product = { ...m.product!, tags: ["reseller-import"] }
    expect(await applyResellerImportReview({ ...base, decision: "approve" })).toMatchObject({ ok: true })
  })
})

describe("loadResellerImportDetail", () => {
  it("gives the admin what to verify, without the reseller's e-mail, and marks the listings that asked to go live", async () => {
    const { loadResellerImportDetail } = await import("@/lib/reseller-import/review.server")
    m.product = {
      id: "p1",
      name: "Lampe",
      tags: [],
      importSource: "reseller_url_import",
      active: true,
      isDraft: false,
      sourceUrl: "https://shop.example/lampe",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      images: ["https://img.example/a.jpg"],
      description: "<p>Une   lampe</p>",
      basePriceCents: 1500,
      stock: 10,
      listingKind: "PHYSICAL",
      attributes: [],
      affiliateProducts: [
        { id: "l1", sellingPriceCents: 2500, isListed: true, createdAt: new Date(), affiliate: { name: "Boutique A" } },
        { id: "l2", sellingPriceCents: 2600, isListed: false, createdAt: new Date(), affiliate: { name: null } },
      ],
    }
    m.requests = [{ payload: { affiliateProductId: "l2", listRequested: true } }]
    const d = await loadResellerImportDetail("p1")
    expect(d?.state).toBe("legacy_unreviewed")
    expect(d?.live).toBe(true)
    expect(d?.descriptionExcerpt).toBe("Une lampe")
    expect(d?.readiness.ready).toBe(false)
    expect(d?.listings.map((l) => [l.listingId, l.listRequested])).toEqual([
      ["l1", false],
      ["l2", true],
    ])
    expect(JSON.stringify(d)).not.toContain("@")
  })

  it("returns null for a product that is not a reseller import", async () => {
    const { loadResellerImportDetail } = await import("@/lib/reseller-import/review.server")
    m.product = { id: "p2", tags: [], importSource: "supplier_csv" }
    expect(await loadResellerImportDetail("p2")).toBeNull()
  })
})
