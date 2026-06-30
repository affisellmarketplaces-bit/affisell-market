import { describe, expect, it } from "vitest"

import { COMMISSION_GRID_MAP } from "@/lib/commission-grid-config"
import {
  buildGoogleIdToSlugPath,
  resolveGridAffisellBpsForCategory,
  resolveGridSupplierBpsForCategory,
} from "@/lib/commission-grid-apply"
import { loadTaxonomyEnRows } from "@/lib/commission-grid-taxonomy"

const taxonomy = loadTaxonomyEnRows()
const googleIdToSlugPath = buildGoogleIdToSlugPath(taxonomy)
const entries = Object.entries(COMMISSION_GRID_MAP)

function googleIdForSlug(slug: string): number {
  const row = taxonomy.find(
    (r) => r.slugPath === slug || r.slugPath.startsWith(`${slug} > `)
  )
  if (!row) throw new Error(`slug not found: ${slug}`)
  return row.googleId
}

describe("resolveGridAffisellBpsForCategory", () => {
  it("picks the more specific slug when branches overlap", () => {
    const telephonyId = googleIdForSlug("electronics > communications > telephony")
    const bps = resolveGridAffisellBpsForCategory({
      googleId: telephonyId,
      fullPath: "unused",
      googleIdToSlugPath,
      entries,
    })
    expect(bps).toBe(500)
  })

  it("lets hygiene override the broader beauty branch", () => {
    const healthCareId = googleIdForSlug("health_beauty > health_care")
    const bps = resolveGridAffisellBpsForCategory({
      googleId: healthCareId,
      fullPath: "unused",
      googleIdToSlugPath,
      entries,
    })
    expect(bps).toBe(800)
  })

  it("matches Affisell extension fullPath without googleId", () => {
    const bps = resolveGridAffisellBpsForCategory({
      googleId: null,
      fullPath: "Vêtements et accessoires > Bijoux > Joaillerie fine",
      googleIdToSlugPath,
      entries,
    })
    expect(bps).toBe(1000)
  })

  it("defaults unmapped categories to 10%", () => {
    const bps = resolveGridAffisellBpsForCategory({
      googleId: null,
      fullPath: "Occasion et reconditionné",
      googleIdToSlugPath,
      entries: [["occasion", COMMISSION_GRID_MAP.occasion!]],
    })
    expect(bps).toBe(1000)
  })
})

describe("resolveGridSupplierBpsForCategory", () => {
  it("applies supplier telephony rate on overlap", () => {
    const telephonyId = googleIdForSlug("electronics > communications > telephony")
    const bps = resolveGridSupplierBpsForCategory({
      googleId: telephonyId,
      fullPath: "unused",
      googleIdToSlugPath,
      entries,
    })
    expect(bps).toBe(800)
  })

  it("applies digital services rate", () => {
    const softwareId = googleIdForSlug("software")
    const bps = resolveGridSupplierBpsForCategory({
      googleId: softwareId,
      fullPath: "unused",
      googleIdToSlugPath,
      entries,
    })
    expect(bps).toBe(2500)
  })

  it("defaults unmapped supplier categories to 15%", () => {
    const bps = resolveGridSupplierBpsForCategory({
      googleId: null,
      fullPath: "unknown",
      googleIdToSlugPath,
      entries,
    })
    expect(bps).toBe(1500)
  })
})
