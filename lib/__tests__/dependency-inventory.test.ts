import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { buildDependencyInventory, INVENTORY_PATH, serializeDependencyInventory } from "../../scripts/generate-dependency-inventory.mjs"

describe("dependency inventory (what the OSV watch checks)", () => {
  it("matches package-lock.json — run `node scripts/generate-dependency-inventory.mjs` after a dependency change", () => {
    const expected = serializeDependencyInventory(buildDependencyInventory(readFileSync("package-lock.json", "utf8")))
    expect(readFileSync(INVENTORY_PATH, "utf8")).toBe(expected)
  })

  it("keeps production packages only, exact versions, each once", () => {
    const inv = buildDependencyInventory(
      JSON.stringify({
        packages: {
          "": { name: "app" },
          "node_modules/next": { version: "16.4.3" },
          "node_modules/vitest": { version: "4.0.0", dev: true },
          "node_modules/a/node_modules/next": { version: "15.0.0" },
          "node_modules/b/node_modules/next": { version: "15.0.0" },
          "node_modules/local": { link: true },
        },
      })
    )
    expect(inv.packages).toEqual([["next", "15.0.0"], ["next", "16.4.3"]])
  })
})
