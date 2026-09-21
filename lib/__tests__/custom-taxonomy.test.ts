import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  CUSTOM_CATEGORIES,
  customCategorySlug,
  customTaxonomyMigrationSql,
  localizeCustomCategoryName,
} from "@/lib/custom-taxonomy"
import { localizeCategoryName } from "@/lib/google-taxonomy-locale"

describe("custom taxonomy", () => {
  it("the migration file is exactly what the code generates (single source of truth)", () => {
    const file = readFileSync("prisma/migrations/20260921120000_custom_taxonomy_modern_products/migration.sql", "utf8")
    expect(file).toBe(customTaxonomyMigrationSql())
  })

  it("has unique slugs and orders above the Google rows", () => {
    const slugs = CUSTOM_CATEGORIES.map((c) => customCategorySlug(c.name))
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs.every((s) => s.endsWith("-affisell"))).toBe(true)
    expect(CUSTOM_CATEGORIES.every((c) => c.order >= 910000)).toBe(true)
  })

  it("has a translation for every non-French locale", () => {
    for (const c of CUSTOM_CATEGORIES) {
      for (const l of ["en", "de", "es", "it", "nl", "pl", "zh"] as const) {
        expect(c.names[l]?.trim().length, `${c.name} / ${l}`).toBeGreaterThan(0)
      }
    }
  })

  it("nested rows point at a section defined earlier in the list", () => {
    const defined = new Set<string>()
    for (const c of CUSTOM_CATEGORIES) {
      if (c.parentPath.includes("Objets connectés et réalité virtuelle")) {
        expect(defined.has(c.parentPath)).toBe(true)
      }
      defined.add(`${c.parentPath} > ${c.name}`)
    }
  })

  it("translates rows without googleId for display, French unchanged", () => {
    expect(localizeCustomCategoryName("Montres connectées", "en")).toBe("Smartwatches")
    expect(localizeCategoryName({ googleId: null, name: "Drones avec caméra" }, "de")).toBe("Kameradrohnen")
    expect(localizeCategoryName({ googleId: null, name: "Drones avec caméra" }, "fr")).toBe("Drones avec caméra")
    expect(localizeCategoryName({ googleId: null, name: "Occasion et reconditionné" }, "en")).toBe("Occasion et reconditionné")
  })
})
