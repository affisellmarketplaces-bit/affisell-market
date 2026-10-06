import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

/**
 * A reseller has several public faces over the SAME listings: the brand store (/shops/{slug}), the boutique
 * (/boutique/{slug}) and the Légion vitrine (/u/{username}). They must apply one visibility rule — a deactivated,
 * draft or internal-test product, or a listing from a non-reseller account, never reaches a buyer on any of them.
 */
describe("public storefront surfaces share the buyer visibility rule", () => {
  it("brand store loader (/shops)", () => {
    expect(read("lib/shop-storefront-data.ts")).toContain("buyerMarketplaceProductWhere")
  })

  it("boutique loader (/boutique)", () => {
    expect(read("lib/boutique/load-reseller-storefront.server.ts")).toContain("buyerListedAffiliateProductWhere")
  })

  it("Légion vitrine (/u/@username), including its empty-state fallback", () => {
    const src = read("app/u/[username]/page.tsx")
    expect(src).toContain("buyerListedAffiliateProductWhere")
    // Both queries (own listings + fallback) go through the shared rule: no bare `isListed: true` left.
    expect(src).not.toMatch(/isListed:\s*true/)
  })
})
