import { describe, expect, it } from "vitest"

import {
  catalogAddedSinceDate,
  parseCatalogAddedWindow,
  parseCatalogVitrineFilter,
} from "@/lib/affiliate-catalog-filters-shared"

describe("affiliate-catalog-filters-shared", () => {
  it("parses vitrine filter aliases", () => {
    expect(parseCatalogVitrineFilter("hors")).toBe("hors")
    expect(parseCatalogVitrineFilter("OUT")).toBe("hors")
    expect(parseCatalogVitrineFilter("en")).toBe("en")
    expect(parseCatalogVitrineFilter("live")).toBe("en")
    expect(parseCatalogVitrineFilter(null)).toBe("all")
    expect(parseCatalogVitrineFilter("")).toBe("all")
  })

  it("parses added window", () => {
    expect(parseCatalogAddedWindow("7d")).toBe("7d")
    expect(parseCatalogAddedWindow("30")).toBe("30d")
    expect(parseCatalogAddedWindow("90d")).toBe("90d")
    expect(parseCatalogAddedWindow(undefined)).toBe("all")
  })

  it("computes added-since date for windows", () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z")
    expect(catalogAddedSinceDate("all", now)).toBeNull()
    const seven = catalogAddedSinceDate("7d", now)
    expect(seven?.toISOString()).toBe("2026-07-27T12:00:00.000Z")
    const thirty = catalogAddedSinceDate("30d", now)
    expect(thirty?.toISOString()).toBe("2026-07-04T12:00:00.000Z")
  })
})
