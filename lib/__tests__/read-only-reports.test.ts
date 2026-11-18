import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { summarizeLegacyImports, type LegacyImportRow } from "@/lib/reseller-import/legacy-inventory"
import { decideReportRun, describeReportTarget, type ReportDatabaseTarget } from "@/lib/reports/report-target"

const prod: ReportDatabaseTarget = { source: ".env.local", endpoint: "ep-misty-sea-al1ne07p", branch: "production", maskedHost: "ep-misty-sea-…neon.tech" }

describe("decideReportRun — no production read without the founder's explicit confirmation", () => {
  it("--target only describes", () => {
    expect(decideReportRun({ target: prod, targetOnly: true, confirmEndpoint: null })).toEqual({ action: "describe" })
  })
  it("production without confirmation is refused, with the exact flag to pass", () => {
    const d = decideReportRun({ target: prod, targetOnly: false, confirmEndpoint: null })
    expect(d.action).toBe("refuse")
    expect(d.action === "refuse" && d.reason).toContain("--confirm-endpoint=ep-misty-sea-al1ne07p")
  })
  it("a confirmation that names another endpoint is refused; the right one runs", () => {
    expect(decideReportRun({ target: prod, targetOnly: false, confirmEndpoint: "ep-other" }).action).toBe("refuse")
    expect(decideReportRun({ target: prod, targetOnly: false, confirmEndpoint: "EP-MISTY-SEA-AL1NE07P" })).toEqual({ action: "run", confirmed: true })
  })
  it("an unidentified database is treated as production; staging and local run; no URL refuses", () => {
    expect(decideReportRun({ target: { ...prod, branch: "unknown" }, targetOnly: false, confirmEndpoint: null }).action).toBe("refuse")
    expect(decideReportRun({ target: { ...prod, branch: "staging" }, targetOnly: false, confirmEndpoint: null }).action).toBe("run")
    expect(decideReportRun({ target: { ...prod, branch: "local" }, targetOnly: false, confirmEndpoint: null }).action).toBe("run")
    expect(decideReportRun({ target: { ...prod, source: "absent" }, targetOnly: false, confirmEndpoint: "x" }).action).toBe("refuse")
  })
  it("the description names the base, the tables and the read-only guarantees", () => {
    const text = describeReportTarget(prod, { tables: ["Product"], purpose: "test" }).join("\n")
    expect(text).toContain("PRODUCTION")
    expect(text).toContain("ep-misty-sea-al1ne07p")
    expect(text).toContain("SET TRANSACTION READ ONLY")
    expect(text).toContain("Product")
  })
})

describe("every report reads through the read-only runner", () => {
  for (const file of [
    "scripts/report-listing-readiness.ts",
    "scripts/report-checkout-stock.ts",
    "scripts/report-legacy-reseller-imports.ts",
  ]) {
    it(file, () => {
      const src = readFileSync(file, "utf8")
      expect(src).toContain("runReadOnlyReport(")
      expect(src).not.toMatch(/new PrismaClient\(/)
      expect(src).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/)
    })
  }
  it("the runner describes the target before connecting and refuses before creating a client", () => {
    const src = readFileSync("scripts/lib/read-only-report.ts", "utf8")
    expect(src.indexOf("describeReportTarget(")).toBeLessThan(src.indexOf("new PrismaClient("))
    expect(src.indexOf('decision.action === "refuse"')).toBeLessThan(src.indexOf("new PrismaClient("))
    expect(src).toContain("withReadOnlyTransaction(readOnlyPrismaClient(base)")
  })
})

describe("summarizeLegacyImports", () => {
  const row = (o: Partial<LegacyImportRow>): LegacyImportRow => ({
    createdAt: new Date("2026-09-10T00:00:00Z"),
    active: true,
    isDraft: false,
    listingKind: "PHYSICAL",
    sourceUrl: "https://www.aliexpress.com/item/1.html",
    basePriceCents: 1000,
    stock: 99,
    imageCount: 3,
    descriptionLength: 200,
    attributes: [],
    listings: [{ isListed: true, affiliateId: "a" }],
    paidOrders90d: 0,
    paidOrdersAllTime: 0,
    openRecalls: 0,
    ...o,
  })
  it("counts products, listings, resellers, sales, sources and the risks of LIVE products only", () => {
    const s = summarizeLegacyImports([
      row({ paidOrders90d: 2, paidOrdersAllTime: 5 }),
      row({ active: false, imageCount: 0, listings: [{ isListed: false, affiliateId: "b" }] }),
      row({ sourceUrl: null, openRecalls: 1, createdAt: new Date("2026-10-02T00:00:00Z"), listings: [{ isListed: true, affiliateId: "a" }, { isListed: true, affiliateId: "c" }] }),
    ])
    expect(s.products).toBe(3)
    expect(s.live).toBe(2)
    expect(s.listings).toBe(4)
    expect(s.listedListings).toBe(3)
    expect(s.resellers).toBe(3)
    expect(s.soldIn90d).toEqual({ products: 1, orders: 2 })
    expect(s.paidOrdersAllTime).toBe(5)
    expect(s.bySourceHost[0]).toEqual({ host: "aliexpress.com", products: 2, live: 1 })
    expect(s.byImportMonth).toEqual([
      { month: "2026-09", products: 2 },
      { month: "2026-10", products: 1 },
    ])
    expect(s.risks.liveWithoutSafetyData).toBe(2)
    expect(s.risks.liveWithOpenRecall).toBe(1)
    expect(s.risks.liveWithoutImage).toBe(0) // the image-less one is not live
    expect(s.risks.liveWithPlaceholderStock).toBe(2)
    expect(s.risks.liveFromUnknownSource).toBe(1)
  })
})
