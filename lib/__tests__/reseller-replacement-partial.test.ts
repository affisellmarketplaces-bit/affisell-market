/**
 * Founder brief 2026-11-19 (15:46): a replacement whose alternative was ADDED but whose old listing could not be
 * WITHDRAWN must be reported as partly done, with a safe resume — no history deleted, no unintended duplicate.
 * Pure rules (`resume.ts`) + the real `replaceListing` / `finishReplacement` on an in-memory database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  decideFinish,
  mayStartReplacement,
  pendingReplacement,
  replaceDoneId,
  replaceStartedId,
  type ReplacementStart,
} from "@/lib/reseller-replacement/resume"

type Listing = { id: string; affiliateId: string; productId: string; isListed: boolean; sellingPriceCents: number }
type Audit = { id: string; action: string; entityType: string; entityId: string; actorId: string; payload: unknown; createdAt: Date }

const db = vi.hoisted(() => ({
  listings: [] as Listing[],
  audit: new Map<string, Audit>(),
  failWithdraw: false,
  withdrawCalls: 0,
  quickAddCalls: 0,
  clock: 0,
}))

const product = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Lampe de bureau LED pliable ${id}`,
  images: [],
  categoryId: "cat-lamp",
  basePriceCents: 2000,
  commissionRate: 15,
  offerMode: null,
  variants: null,
  hasVariants: false,
  stock: 10,
  listingKind: "PHYSICAL",
  active: true,
  isDraft: false,
  tags: [],
  colors: [],
  deliveryMax: 7,
  supplier: { store: { name: "Maison Lune" } },
  attributes: [{ key: "gtin", value: "4006381333931" }],
  ...over,
})

const PRODUCTS: Record<string, ReturnType<typeof product>> = {
  P0: product("P0", { stock: 0 }),
  PA: product("PA"),
  PB: product("PB", { attributes: [] }),
}

function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
}

vi.mock("@/lib/affiliate-catalog-query", () => ({ buildAffiliateCatalogProductWhere: async () => ({}) }))

vi.mock("@/lib/affiliate-quick-add-listing.server", () => ({
  quickAddAffiliateListing: async ({ affiliateId, productId }: { affiliateId: string; productId: string }) => {
    db.quickAddCalls += 1
    let l = db.listings.find((x) => x.affiliateId === affiliateId && x.productId === productId)
    const created = !l
    if (!l) {
      l = { id: `L-${productId}`, affiliateId, productId, isListed: true, sellingPriceCents: 2600 }
      db.listings.push(l)
    } else {
      l.isListed = true
    }
    return { ok: true, listing: { id: l.id, productId, sellingPriceCents: l.sellingPriceCents, isListed: l.isListed }, created, publishBlocked: null }
  },
}))

vi.mock("@/lib/prisma", () => {
  const matchListing = (l: Listing, where: Record<string, unknown>) => {
    if (where.id && l.id !== where.id) return false
    if (where.affiliateId && l.affiliateId !== where.affiliateId) return false
    const pid = where.productId as { in?: string[] } | string | undefined
    if (typeof pid === "string" && l.productId !== pid) return false
    if (pid && typeof pid === "object" && pid.in && !pid.in.includes(l.productId)) return false
    return true
  }
  const client = {
    user: { findUnique: async () => ({ affiliatePlatformFeeBps: null }) },
    product: {
      findMany: async () => [PRODUCTS.PA],
      findUnique: async ({ where }: { where: { id: string } }) => PRODUCTS[where.id] ?? null,
    },
    affiliateProduct: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const l = db.listings.find((x) => matchListing(x, where))
        return l ? { ...l, product: PRODUCTS[l.productId] } : null
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => db.listings.filter((x) => matchListing(x, where)).map((l) => ({ ...l })),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { isListed: boolean } }) => {
        db.withdrawCalls += 1
        if (db.failWithdraw) throw new Error("connection reset")
        const hit = db.listings.filter((x) => matchListing(x, where))
        hit.forEach((x) => (x.isListed = data.isListed))
        return { count: hit.length }
      },
    },
    auditLog: {
      findUnique: async ({ where }: { where: { id: string } }) => db.audit.get(where.id) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const rows = [...db.audit.values()].filter((a) => {
          const ids = (where.id as { in?: string[] } | undefined)?.in
          if (ids) return ids.includes(a.id)
          return a.action === where.action && a.entityId === where.entityId && a.actorId === where.actorId
        })
        return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      },
      create: async ({ data }: { data: Omit<Audit, "createdAt"> }) => {
        if (db.audit.has(data.id)) throw uniqueViolation()
        db.audit.set(data.id, { ...data, createdAt: new Date(++db.clock) })
        return data
      },
      createMany: async ({ data }: { data: Array<Omit<Audit, "createdAt">> }) => {
        let count = 0
        for (const d of data) {
          if (db.audit.has(d.id)) continue
          db.audit.set(d.id, { ...d, createdAt: new Date(++db.clock) })
          count += 1
        }
        return { count }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  }
  return { prisma: client }
})

import { finishReplacement, loadPendingReplacement, replaceListing } from "@/lib/reseller-replacement/replace.server"

const AFF = "aff-1"

beforeEach(() => {
  db.listings = [{ id: "L0", affiliateId: AFF, productId: "P0", isListed: true, sellingPriceCents: 2600 }]
  db.audit = new Map()
  db.failWithdraw = false
  db.withdrawCalls = 0
  db.quickAddCalls = 0
  db.clock = 0
})

const listing = (id: string) => db.listings.find((l) => l.id === id)
const auditOf = (action: string) => [...db.audit.values()].filter((a) => a.action === action)

describe("partial replacement — pure rules", () => {
  const start = (over: Partial<ReplacementStart> = {}): ReplacementStart => ({
    toProductId: "PA",
    startedAt: new Date(1),
    done: false,
    newListing: { id: "L-PA", isListed: true },
    ...over,
  })

  it("is pending only when started, not done, the old listing still listed and the new listing present", () => {
    expect(pendingReplacement({ oldListingIsListed: true, starts: [start()] })?.toProductId).toBe("PA")
    expect(pendingReplacement({ oldListingIsListed: false, starts: [start()] })).toBeNull()
    expect(pendingReplacement({ oldListingIsListed: true, starts: [start({ done: true })] })).toBeNull()
    expect(pendingReplacement({ oldListingIsListed: true, starts: [start({ newListing: null })] })).toBeNull()
    expect(pendingReplacement({ oldListingIsListed: true, starts: [] })).toBeNull()
  })

  it("blocks another replacement while one is pending, never a retry of the same one", () => {
    const pending = pendingReplacement({ oldListingIsListed: true, starts: [start()] })
    expect(mayStartReplacement(pending, "PA")).toEqual({ allow: true })
    expect(mayStartReplacement(pending, "PB")).toMatchObject({ allow: false, reason: "replacement_pending" })
    expect(mayStartReplacement(null, "PB")).toEqual({ allow: true })
  })

  it("finish only withdraws, and refuses what was never started or has no new listing", () => {
    expect(decideFinish({ start: start(), oldListingIsListed: true })).toEqual({ action: "withdraw_old" })
    expect(decideFinish({ start: start({ done: true }), oldListingIsListed: true })).toEqual({ action: "already_done" })
    expect(decideFinish({ start: start(), oldListingIsListed: false })).toEqual({ action: "already_done" })
    expect(decideFinish({ start: null, oldListingIsListed: true })).toMatchObject({ reason: "not_started" })
    expect(decideFinish({ start: start({ newListing: null }), oldListingIsListed: true })).toMatchObject({ reason: "new_listing_missing" })
  })

  it("uses deterministic ids so a replay writes nothing twice", () => {
    expect(replaceStartedId("L0", "PA")).toBe("listing-replace:L0:PA")
    expect(replaceDoneId("L0", "PA")).toBe("listing-replace-done:L0:PA")
  })
})

describe("partial replacement — the real flow on an in-memory database", () => {
  it("a normal replacement is complete: one start, one done, old listing out, nothing deleted", async () => {
    const r = await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    expect(r).toMatchObject({ ok: true, status: "complete", previousListingWithdrawn: true })
    expect(listing("L0")).toMatchObject({ isListed: false })
    expect(listing("L-PA")).toMatchObject({ isListed: true })
    expect(db.audit.has(replaceStartedId("L0", "PA"))).toBe(true)
    expect(auditOf("affiliate.listing_replaced")).toHaveLength(1)
    expect(db.listings).toHaveLength(2)
  })

  it("withdrawal failure → `partial`, both in the shop, the page sees it pending", async () => {
    db.failWithdraw = true
    const r = await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    expect(r).toMatchObject({ ok: true, status: "partial", previousListingWithdrawn: false, newListingId: "L-PA" })
    expect(listing("L0")?.isListed).toBe(true)
    expect(listing("L-PA")?.isListed).toBe(true)
    expect(auditOf("affiliate.listing_replaced")).toHaveLength(0)
    const pending = await loadPendingReplacement(AFF, "L0", true)
    expect(pending).toMatchObject({ toProductId: "PA", newListingId: "L-PA", toProductName: PRODUCTS.PA.name })
  })

  it("while pending, another replacement is refused — no third product in the shop", async () => {
    db.failWithdraw = true
    await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    const adds = db.quickAddCalls
    const r = await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PB", confirm: true })
    expect(r).toMatchObject({ ok: false, error: "replacement_pending", pending: { toProductId: "PA" } })
    expect(db.quickAddCalls).toBe(adds)
    expect(db.listings.map((l) => l.productId).sort()).toEqual(["P0", "PA"])
  })

  it("« finish » withdraws the old listing once, never re-adds, and is idempotent", async () => {
    db.failWithdraw = true
    await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    db.failWithdraw = false
    const adds = db.quickAddCalls
    const f1 = await finishReplacement({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    expect(f1).toMatchObject({ ok: true, status: "complete", newListingId: "L-PA" })
    expect(listing("L0")?.isListed).toBe(false)
    expect(listing("L-PA")?.isListed).toBe(true)
    const withdrawals = db.withdrawCalls
    const f2 = await finishReplacement({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    expect(f2).toMatchObject({ ok: true, status: "complete" })
    expect(db.withdrawCalls).toBe(withdrawals)
    expect(db.quickAddCalls).toBe(adds)
    expect(auditOf("affiliate.listing_replaced")).toHaveLength(1)
    expect(await loadPendingReplacement(AFF, "L0", false)).toBeNull()
    expect(db.listings).toHaveLength(2)
  })

  it("retrying the same replacement after a partial run is the finish (no second add)", async () => {
    db.failWithdraw = true
    await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    db.failWithdraw = false
    const adds = db.quickAddCalls
    const r = await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    expect(r).toMatchObject({ ok: true, status: "complete" })
    expect(db.quickAddCalls).toBe(adds)
    expect(listing("L0")?.isListed).toBe(false)
  })

  it("a failing finish stays partial and says so", async () => {
    db.failWithdraw = true
    await replaceListing({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    const f = await finishReplacement({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    expect(f).toMatchObject({ ok: true, status: "partial", previousListingWithdrawn: false })
  })

  it("finish refuses a replacement that was never started", async () => {
    const f = await finishReplacement({ affiliateId: AFF, listingId: "L0", productId: "PA", confirm: true })
    expect(f).toMatchObject({ ok: false, error: "nothing_to_finish" })
    expect(listing("L0")?.isListed).toBe(true)
  })

  it("another reseller's listing is not found", async () => {
    const f = await finishReplacement({ affiliateId: "other", listingId: "L0", productId: "PA", confirm: true })
    expect(f).toMatchObject({ ok: false, error: "not_found" })
  })
})
