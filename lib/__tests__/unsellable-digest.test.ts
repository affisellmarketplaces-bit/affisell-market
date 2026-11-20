/**
 * Founder brief 2026-11-19: unsellable-product notices become ONE intelligent daily notice per reseller, never a stream.
 * The real `runUnsellableListingAlerts` in `enforce` on an in-memory database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  planDigests,
  UNSELLABLE_DIGEST_NOTIF,
  UNSELLABLE_LISTING_NOTIF,
  unsellableDigestId,
} from "@/lib/reseller-replacement/unsellable-alerts"
import { summarizeObservation } from "@/lib/reseller-replacement/unsellable-observation"

type Row = { id: string; affiliateId: string; product: Record<string, unknown> }
const db = vi.hoisted(() => ({
  listings: [] as Row[],
  audit: new Map<string, { id: string; payload?: unknown }>(),
  notifications: [] as Array<{ userId: string; type: string; orderId?: string | null; message: string }>,
  inAppOff: new Set<string>(),
}))

vi.mock("@/lib/i18n-load-messages", () => ({
  loadAppMessages: () => ({
    affiliate: { replacement: { bellMessage: "{product} unsellable", digestMessage: "{count} unsellable" } },
  }),
}))
vi.mock("@/lib/intelligence/profit-alerts.server", () => ({
  loadAlertPreference: async (id: string) => ({ inApp: !db.inAppOff.has(id), email: false, locale: "fr" }),
}))
vi.mock("@/lib/prisma", () => {
  const unique = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
  return {
    prisma: {
      affiliateProduct: {
        findMany: async ({ cursor }: { cursor?: { id: string } }) => (cursor ? [] : db.listings),
      },
      auditLog: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.filter((id) => db.audit.has(id)).map((id) => ({ id })),
        create: async ({ data }: { data: { id: string } }) => {
          if (db.audit.has(data.id)) throw unique()
          db.audit.set(data.id, data)
          return data
        },
        createMany: async ({ data }: { data: Array<{ id: string }> }) => {
          let count = 0
          for (const d of data) if (!db.audit.has(d.id)) (db.audit.set(d.id, d), count++)
          return { count }
        },
      },
      notification: {
        create: async ({ data }: { data: { userId: string; type: string; orderId?: string; message: string } }) => {
          db.notifications.push(data)
          return data
        },
      },
    },
  }
})

import { runUnsellableListingAlerts } from "@/lib/reseller-replacement/unsellable-alerts.server"

const soldOut = { name: "P", active: true, isDraft: false, tags: [], stock: 0, hasVariants: false, variants: null, listingKind: "PHYSICAL", commissionRate: 10, offerMode: null }
const day1 = new Date("2026-11-19T06:00:00Z")
const day2 = new Date("2026-11-20T06:00:00Z")

beforeEach(() => {
  vi.stubEnv("RESELLER_UNSELLABLE_ALERTS_MODE", "enforce")
  db.listings = [
    { id: "l1", affiliateId: "a", product: { ...soldOut, name: "A1" } },
    { id: "l2", affiliateId: "a", product: { ...soldOut, name: "A2" } },
    { id: "l3", affiliateId: "a", product: { ...soldOut, name: "A3" } },
    { id: "l4", affiliateId: "b", product: { ...soldOut, name: "B1" } },
  ]
  db.audit = new Map()
  db.notifications = []
  db.inAppOff = new Set()
})
afterEach(() => vi.unstubAllEnvs())

describe("daily unsellable digest", () => {
  it("plans one notice per reseller: single for one product, digest for several", () => {
    const plan = planDigests([
      { affiliateId: "a", id: 1 },
      { affiliateId: "b", id: 2 },
      { affiliateId: "a", id: 3 },
    ])
    expect(plan.map((p) => [p.affiliateId, p.kind, p.items.length])).toEqual([
      ["a", "digest", 2],
      ["b", "single", 1],
    ])
    expect(unsellableDigestId("a", day1)).toBe("listing-unsellable-digest:a:2026-11-19")
  })

  it("sends ONE bell per reseller and per day, and nothing again the same day", async () => {
    const run = await runUnsellableListingAlerts(day1)
    expect(run).toMatchObject({ unsellable: 4, notified: 2, digests: 1 })
    expect(db.notifications.map((n) => [n.userId, n.type, n.orderId ?? null])).toEqual([
      ["a", UNSELLABLE_DIGEST_NOTIF, null],
      ["b", UNSELLABLE_LISTING_NOTIF, "l4"],
    ])
    const again = await runUnsellableListingAlerts(day1)
    expect(again.notified).toBe(0)
    expect(again.alreadyNotified).toBe(4)
    expect(db.notifications).toHaveLength(2)
  })

  it("a reseller already told today keeps its new products for tomorrow — never lost, never doubled", async () => {
    await runUnsellableListingAlerts(day1)
    db.listings.push({ id: "l5", affiliateId: "a", product: { ...soldOut, name: "A5" } })
    const sameDay = await runUnsellableListingAlerts(day1)
    expect(sameDay).toMatchObject({ notified: 0, deferredToTomorrow: 1 })
    const tomorrow = await runUnsellableListingAlerts(day2)
    expect(tomorrow.notified).toBe(1)
    expect(db.notifications.at(-1)).toMatchObject({ userId: "a", type: UNSELLABLE_LISTING_NOTIF, orderId: "l5" })
  })

  it("respects the in-app preference and claims nothing for that reseller", async () => {
    db.inAppOff.add("a")
    const run = await runUnsellableListingAlerts(day1)
    expect(run).toMatchObject({ notified: 1, skippedPreference: 3 })
    expect([...db.audit.keys()].some((k) => k.includes(":l1:"))).toBe(false)
  })

  it("the observation measures the digest's saving: one notice per reseller instead of one per product", () => {
    const items = [
      { affiliateId: "a", listingId: "l1", problem: "out_of_stock" as const },
      { affiliateId: "a", listingId: "l2", problem: "out_of_stock" as const },
      { affiliateId: "b", listingId: "l3", problem: "out_of_stock" as const },
    ]
    const o = summarizeObservation({ now: day1, scanned: 10, truncated: false, items, newItems: items, inAppOff: new Set() })
    expect(o).toMatchObject({ wouldNotifyNew: 3, wouldNotifyResellers: 2 })
  })
})
