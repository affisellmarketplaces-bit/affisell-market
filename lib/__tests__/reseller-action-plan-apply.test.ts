import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Apply / undo against an in-memory database: the action is recomputed (stale refused), recorded in AuditLog with
 * before/after, and undone only when nobody changed the listing since.
 */
type Listing = {
  id: string
  affiliateId: string
  sellingPriceCents: number
  marginCents: number
  isListed: boolean
  variantPricing: unknown
  clicks: number
  conversions: number
  marginReviewNeeded: boolean
  marginReviewVariantKeys: string[]
  marginReviewAt: Date | null
  marginReviewAlertHash: string | null
  updatedAt: Date
  position: number
  product: {
    id: string
    name: string
    basePriceCents: number
    commissionRate: number
    categoryId: null
    supplierId: string
    variants: null
  }
}
const db = vi.hoisted(() => ({
  listings: new Map<string, Listing>(),
  audit: [] as Array<{
    id: string
    action: string
    entityType: string
    entityId: string
    actorId: string
    payload: unknown
    createdAt: Date
  }>,
  kycBlocked: false,
  beforeWrite: null as null | ((l: Listing) => void),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/affiliate-catalog-opportunity-pulse", () => ({
  loadAffiliateOpportunityPulsePicks: vi.fn(async () => []),
}))
vi.mock("@/lib/auction-listing-lifecycle", () => ({ cancelAuctionsForListings: vi.fn(async () => 0) }))
vi.mock("@/lib/revalidate-affiliate-shopfront", () => ({ revalidateAffiliateShopfront: vi.fn(async () => undefined) }))
vi.mock("@/lib/revalidate-listing-card-image", () => ({ revalidateListingCardImage: vi.fn() }))
vi.mock("@/lib/merchant-legal/require-merchant-verified", () => ({
  requireMerchantVerifiedForPublish: vi.fn(async () => (db.kycBlocked ? new Response(null, { status: 403 }) : null)),
}))
vi.mock("@/lib/affiliate-margin-auto-fix-apply.server", () => ({ applyMarginAutoFixToListing: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const pick = (l: Listing) => ({
    sellingPriceCents: l.sellingPriceCents,
    marginCents: l.marginCents,
    isListed: l.isListed,
    variantPricing: l.variantPricing,
    marginReviewNeeded: l.marginReviewNeeded,
    marginReviewVariantKeys: l.marginReviewVariantKeys,
    marginReviewAt: l.marginReviewAt,
    marginReviewAlertHash: l.marginReviewAlertHash,
    updatedAt: l.updatedAt,
  })
  return {
    prisma: {
      $queryRaw: vi.fn(async () => []),
      user: { findUnique: vi.fn(async () => ({ affiliatePlatformFeeBps: null })) },
      order: { groupBy: vi.fn(async () => []), findMany: vi.fn(async () => []) },
      affiliateProduct: {
        findMany: vi.fn(async ({ where }: { where: { affiliateId: string; isListed: boolean } }) =>
          [...db.listings.values()].filter((l) => l.affiliateId === where.affiliateId && l.isListed === where.isListed),
        ),
        findFirst: vi.fn(async ({ where }: { where: { id: string; affiliateId: string } }) => {
          const l = db.listings.get(where.id)
          return l && l.affiliateId === where.affiliateId
            ? { ...pick(l), product: { basePriceCents: l.product.basePriceCents } }
            : null
        }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const l = db.listings.get(where.id)
          return l ? pick(l) : null
        }),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; affiliateId: string; updatedAt: Date }
            data: Partial<Listing>
          }) => {
            const l = db.listings.get(where.id)
            if (!l || l.affiliateId !== where.affiliateId || l.updatedAt.getTime() !== where.updatedAt.getTime()) {
              return { count: 0 }
            }
            db.beforeWrite?.(l)
            if (l.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 }
            const clean = Object.fromEntries(
              Object.entries(data).map(([k, v]) => [
                k,
                v && typeof v === "object" && "toJSON" in (v as object) && String(v) === "DbNull" ? null : v,
              ]),
            )
            Object.assign(l, clean, { updatedAt: new Date(l.updatedAt.getTime() + 1000) })
            return { count: 1 }
          },
        ),
      },
      auditLog: {
        create: vi.fn(async ({ data }: { data: Omit<(typeof db.audit)[number], "id" | "createdAt"> }) => {
          const row = { ...data, id: `aud_${String(db.audit.length + 1).padStart(6, "0")}`, createdAt: new Date() }
          db.audit.push(row)
          return { id: row.id }
        }),
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.id) {
            return (
              db.audit.find((a) => a.id === where.id && a.action === where.action && a.actorId === where.actorId) ??
              null
            )
          }
          const undoOf = (where.payload as { equals: string }).equals
          return (
            db.audit.find((a) => a.action === where.action && (a.payload as { undoOf?: string })?.undoOf === undoOf) ??
            null
          )
        }),
      },
    },
  }
})

import { applyCopilotAction, undoCopilotAction, UNDO_WINDOW_MS } from "@/lib/reseller-action-plan.server"

const AFF = "aff_000001"

function seedThin() {
  db.listings.clear()
  db.audit.length = 0
  db.kycBlocked = false
  db.beforeWrite = null
  db.listings.set("lst_000001", {
    id: "lst_000001",
    affiliateId: AFF,
    sellingPriceCents: 5300,
    marginCents: 300,
    isListed: true,
    variantPricing: null,
    clicks: 0,
    conversions: 0,
    marginReviewNeeded: false,
    marginReviewVariantKeys: [],
    marginReviewAt: null,
    marginReviewAlertHash: null,
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    position: 0,
    product: {
      id: "prod_000001",
      name: "Lampe",
      basePriceCents: 5000,
      commissionRate: 5,
      categoryId: null,
      supplierId: "sup_1",
      variants: null,
    },
  })
}

describe("copilot apply / undo", () => {
  beforeEach(seedThin)

  it("applies the recomputed reprice, records before/after, and undoes it", async () => {
    const r = await applyCopilotAction({ affiliateId: AFF, actionId: "reprice:lst_000001" })
    expect(r.ok).toBe(true)
    const l = db.listings.get("lst_000001")!
    expect(l.sellingPriceCents).toBeGreaterThan(5300)
    expect(l.marginCents).toBe(l.sellingPriceCents - 5000)
    expect(db.audit[0]).toMatchObject({
      action: "copilot.apply",
      entityId: "lst_000001",
      actorId: AFF,
      payload: { actionId: "reprice:lst_000001", before: { sellingPriceCents: 5300 } },
    })
    const u = await undoCopilotAction({ affiliateId: AFF, auditId: r.ok ? r.auditId : "" })
    expect(u).toEqual({ ok: true })
    expect(db.listings.get("lst_000001")).toMatchObject({ sellingPriceCents: 5300, marginCents: 300 })
    expect(await undoCopilotAction({ affiliateId: AFF, auditId: r.ok ? r.auditId : "" })).toEqual({
      ok: false,
      reason: "already_undone",
    })
  })

  it("refuses a stale action (the plan no longer contains it) and an action of another reseller", async () => {
    db.listings.get("lst_000001")!.sellingPriceCents = 9000 // already healthy: no reprice in the plan any more
    expect(await applyCopilotAction({ affiliateId: AFF, actionId: "reprice:lst_000001" })).toEqual({
      ok: false,
      reason: "stale",
    })
    seedThin()
    expect(await applyCopilotAction({ affiliateId: "aff_other1", actionId: "reprice:lst_000001" })).toEqual({
      ok: false,
      reason: "stale",
    })
    expect(db.listings.get("lst_000001")!.sellingPriceCents).toBe(5300)
    expect(db.audit).toHaveLength(0)
  })

  it("never overwrites a change made after the action: undo refused", async () => {
    const r = await applyCopilotAction({ affiliateId: AFF, actionId: "reprice:lst_000001" })
    const edited = db.listings.get("lst_000001")!
    edited.sellingPriceCents = 7777 // the reseller edited the price by hand
    edited.updatedAt = new Date(edited.updatedAt.getTime() + 5000)
    expect(await undoCopilotAction({ affiliateId: AFF, auditId: r.ok ? r.auditId : "" })).toEqual({
      ok: false,
      reason: "changed_since",
    })
    expect(db.listings.get("lst_000001")!.sellingPriceCents).toBe(7777)
  })

  it("undo window: 7 days; another reseller cannot undo", async () => {
    const r = await applyCopilotAction({ affiliateId: AFF, actionId: "reprice:lst_000001" })
    const id = r.ok ? r.auditId : ""
    expect(await undoCopilotAction({ affiliateId: "aff_other1", auditId: id })).toEqual({
      ok: false,
      reason: "not_found",
    })
    expect(
      await undoCopilotAction({ affiliateId: AFF, auditId: id, now: new Date(Date.now() + UNDO_WINDOW_MS + 60_000) }),
    ).toEqual({ ok: false, reason: "expired" })
  })

  it("pause is undoable, and putting it back online still requires identity verification", async () => {
    const l = db.listings.get("lst_000001")!
    l.sellingPriceCents = 3000 // below the supplier's 50 €: loses money, not savable within +25 %
    l.marginCents = 0
    const r = await applyCopilotAction({ affiliateId: AFF, actionId: "pause:lst_000001" })
    expect(r.ok).toBe(true)
    expect(l.isListed).toBe(false)
    db.kycBlocked = true
    expect(await undoCopilotAction({ affiliateId: AFF, auditId: r.ok ? r.auditId : "" })).toEqual({
      ok: false,
      reason: "kyc_required",
    })
    db.kycBlocked = false
    expect(await undoCopilotAction({ affiliateId: AFF, auditId: r.ok ? r.auditId : "" })).toEqual({ ok: true })
    expect(l.isListed).toBe(true)
  })

  it("a concurrent edit landing between the check and the undo write is never overwritten", async () => {
    const r = await applyCopilotAction({ affiliateId: AFF, actionId: "reprice:lst_000001" })
    db.beforeWrite = (l) => {
      l.sellingPriceCents = 8888 // someone saves the listing at that exact moment
      l.updatedAt = new Date(l.updatedAt.getTime() + 7)
    }
    expect(await undoCopilotAction({ affiliateId: AFF, auditId: r.ok ? r.auditId : "" })).toEqual({
      ok: false,
      reason: "changed_since",
    })
    expect(db.listings.get("lst_000001")!.sellingPriceCents).toBe(8888)
  })

  it("undoing a margin fix restores the supplier price-rise flags it had cleared", async () => {
    const l = db.listings.get("lst_000001")!
    Object.assign(l, {
      sellingPriceCents: 9000,
      marginCents: 4000,
      marginReviewNeeded: true,
      marginReviewVariantKeys: ["Noir"],
      marginReviewAt: new Date("2026-11-20T00:00:00Z"),
      marginReviewAlertHash: "h_abc",
    })
    const { applyMarginAutoFixToListing } = await import("@/lib/affiliate-margin-auto-fix-apply.server")
    vi.mocked(applyMarginAutoFixToListing).mockImplementationOnce(async () => {
      Object.assign(l, {
        sellingPriceCents: 9500,
        marginReviewNeeded: false,
        marginReviewVariantKeys: [],
        marginReviewAt: null,
        marginReviewAlertHash: null,
        updatedAt: new Date(l.updatedAt.getTime() + 1000),
      })
      return { ok: true, listingId: "lst_000001", keysFixed: 1, cleared: true }
    })
    const r = await applyCopilotAction({ affiliateId: AFF, actionId: "fix_margins:lst_000001" })
    expect(r.ok).toBe(true)
    expect(await undoCopilotAction({ affiliateId: AFF, auditId: r.ok ? r.auditId : "" })).toEqual({ ok: true })
    expect(l).toMatchObject({
      sellingPriceCents: 9000,
      marginReviewNeeded: true,
      marginReviewVariantKeys: ["Noir"],
      marginReviewAlertHash: "h_abc",
    })
    expect(l.marginReviewAt?.toISOString()).toBe("2026-11-20T00:00:00.000Z")
  })
})
