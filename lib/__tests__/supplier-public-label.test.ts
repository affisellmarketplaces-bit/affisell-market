import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  AFFISELL_SUPPLIER_FALLBACK_LABEL,
  resellerFacingSupplierLabel,
  resellerFacingSupplierName,
} from "@/lib/supplier-public-label"
import { serializeProductQuote } from "@/lib/product-request-types"

const root = path.resolve(__dirname, "../..")
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8")

describe("supplier identity shown to resellers (founder decision 2026-11-19)", () => {
  it("uses the store name, else « Fournisseur Affisell »", () => {
    expect(resellerFacingSupplierLabel({ name: "  Maison Lune " })).toBe("Maison Lune")
    expect(resellerFacingSupplierLabel(null)).toBe(AFFISELL_SUPPLIER_FALLBACK_LABEL)
    expect(resellerFacingSupplierLabel({ name: "   " })).toBe("Fournisseur Affisell")
    expect(resellerFacingSupplierLabel(undefined, "Affisell supplier")).toBe("Affisell supplier")
  })

  it("never shows a store name that is an e-mail address", () => {
    expect(resellerFacingSupplierName({ name: "contact@acme.fr" })).toBeNull()
    expect(resellerFacingSupplierLabel({ name: "Acme — contact@acme.fr" })).toBe("Fournisseur Affisell")
  })

  it("caps a very long store name", () => {
    const label = resellerFacingSupplierLabel({ name: "x".repeat(200) })
    expect(label.length).toBeLessThanOrEqual(80)
  })

  it("a serialized quote never carries the e-mail or the person's name", () => {
    const row = {
      id: "q1",
      requestId: "r1",
      supplierId: "s1",
      supplierName: "Jean Dupont",
      supplierEmail: "jean@example.com",
      price: 10,
      moq: 1,
      deliveryDays: 5,
      message: null,
      status: "pending",
      createdAt: new Date("2026-11-19T00:00:00Z"),
    }
    const anonymous = serializeProductQuote(row)
    expect(JSON.stringify(anonymous)).not.toContain("jean@example.com")
    expect(JSON.stringify(anonymous)).not.toContain("Jean Dupont")
    expect(anonymous.supplierName).toBeNull()
    expect(serializeProductQuote(row, new Map([["s1", "Maison Lune"]])).supplierName).toBe("Maison Lune")
  })

  it("quote routes never pass serializeProductQuote straight to map() (the index would be read as the store map)", () => {
    for (const f of [
      "app/api/requests/[id]/quotes/route.ts",
      "app/api/requests/[id]/quotes/[quoteId]/accept/route.ts",
      "app/dashboard/reseller/requests/[id]/page.tsx",
      "app/dashboard/supplier/requests/[id]/page.tsx",
    ]) {
      expect(read(f)).not.toMatch(/\.map\(serializeProductQuote\)/)
    }
  })

  it("reseller-facing catalogue code never reads the supplier's e-mail", () => {
    const files = [
      "lib/affiliate-dashboard-data.ts",
      "lib/affiliate-catalog-query.ts",
      "lib/affiliate-catalog-types.ts",
      "lib/affiliate-catalog-opportunity-pulse.ts",
      "lib/agent-affiliate-catalog-search.ts",
      "lib/affiliate-swipe-feed.server.ts",
      "lib/intelligence/opportunities.server.ts",
      "components/affiliate/affiliate-catalog-experience.tsx",
      "app/dashboard/affiliate/affiliate-dashboard.tsx",
      "components/requests/ResellerQuotesComparator.tsx",
    ]
    for (const f of files) {
      const src = read(f)
      expect(src, f).not.toMatch(/supplier\??\.email|supplierEmail/)
    }
    // The catalogue select feeding every reseller card must not fetch it at all.
    expect(read("lib/affiliate-dashboard-data.ts")).not.toMatch(/const supplierPick = \{\s*select: \{\s*email/)
  })
})
