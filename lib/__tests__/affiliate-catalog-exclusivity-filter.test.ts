import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { buildAffiliateCatalogProductWhere } from "@/lib/affiliate-catalog-query"
import { buildSwipeFeedWhere } from "@/lib/affiliate-swipe-feed.server"

const isExclusivityFilter = (part: unknown, affiliateId: string) =>
  JSON.stringify(part).includes(`"exclusiveAffiliateId":"${affiliateId}"`) &&
  JSON.stringify(part).includes('"exclusiveUntil":{"lte"')

describe("affiliate catalogue exclusivity filter", () => {
  it("hides products held in exclusivity by another reseller, keeps open / expired / own ones", async () => {
    const where = await buildAffiliateCatalogProductWhere(new URLSearchParams(), { affiliateId: "me" })
    const parts = (where.AND as unknown[]) ?? []
    const filter = parts.find((p) => isExclusivityFilter(p, "me")) as { OR: unknown[] } | undefined
    expect(filter).toBeTruthy()
    expect(filter!.OR).toHaveLength(4)
  })

  it("leaves the query untouched without a reseller (nothing to compare the holder with)", async () => {
    const where = await buildAffiliateCatalogProductWhere(new URLSearchParams())
    expect(JSON.stringify(where)).not.toContain("exclusiveAffiliateId")
  })

  it("applies to the swipe feed too (it used to build the catalogue filter without the reseller)", async () => {
    const where = await buildSwipeFeedWhere("me", {} as never)
    expect(JSON.stringify(where)).toContain('"exclusiveAffiliateId":"me"')
  })
})
