/**
 * Chantier 3: automated imports go through the same "ready to publish" gate as a hand-made sheet. In enforce mode an
 * incomplete import is created as a DRAFT (never refused: an import is a batch). Imports never publish by themselves.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { decideImportPublication } from "@/lib/listing-compliance/import-publication.server"

const base = { source: "import_sync" as const, supplierId: "s1" }

describe("decideImportPublication", () => {
  it("an import that does not ask to go live stays a draft", () => {
    expect(decideImportPublication({ ...base, wantLive: false, mode: "enforce" })).toEqual({
      live: false,
      downgradedToDraft: false,
    })
  })

  it("warn (default rollout): a not-ready physical product still goes live, the gate only logs", () => {
    expect(decideImportPublication({ ...base, wantLive: true, listingKind: "PHYSICAL", mode: "warn" }).live).toBe(true)
  })

  it("enforce: a physical product without the safety data is created as a draft", () => {
    expect(decideImportPublication({ ...base, wantLive: true, listingKind: "PHYSICAL", mode: "enforce" })).toEqual({
      live: false,
      downgradedToDraft: true,
    })
  })

  it("enforce: digital goods are out of scope and go live", () => {
    expect(decideImportPublication({ ...base, wantLive: true, listingKind: "DIGITAL", mode: "enforce" }).live).toBe(true)
  })

  it("off: nothing is checked", () => {
    expect(decideImportPublication({ ...base, wantLive: true, listingKind: "PHYSICAL", mode: "off" }).live).toBe(true)
  })
})

describe("every automated importer that can publish reads the gate", () => {
  const root = path.resolve(__dirname, "../..")
  it.each([
    "lib/supplier-sync/sync-engine.ts",
    "lib/supplier-products-import-exec.ts",
    "lib/supplier-dropforge-import.server.ts",
    "lib/marketplace/import-from-url.server.ts",
  ])("%s", (file) => {
    expect(readFileSync(path.join(root, file), "utf8")).toContain("decideImportPublication(")
  })
})
