import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { findMissingTaxonomyPaths } from "@/lib/category-taxonomy-coverage"

describe("category taxonomy coverage", () => {
  it("taxonomy-fr.txt contains leaves required for product-intent matching", () => {
    const file = join(process.cwd(), "prisma", "taxonomy-fr.txt")
    const content = readFileSync(file, "utf-8")
    const missing = findMissingTaxonomyPaths(content)
    expect(missing).toEqual([])
  })
})
