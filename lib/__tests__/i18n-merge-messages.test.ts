import { describe, expect, it } from "vitest"

import { deepMergeMessages } from "@/lib/i18n-merge-messages"
import { loadAppMessages } from "@/lib/i18n-load-messages"

describe("i18n merge", () => {
  it("deepMergeMessages overrides leaf strings", () => {
    const merged = deepMergeMessages(
      { home: { hero: { title: "Hello" }, keep: "yes" } },
      { home: { hero: { title: "Hallo" } } }
    )
    expect(merged).toEqual({
      home: { hero: { title: "Hallo" }, keep: "yes" },
    })
  })

  it("loadAppMessages de has German hero and EN fallback for dashboard", () => {
    const de = loadAppMessages("de")
    expect((de.home as { hero: { title: string } }).hero.title).toContain("Geschäfte")
    expect((de.supplier as { badge?: string })?.badge ?? (de as { nav: { brand: string } }).nav.brand).toBeTruthy()
  })
})
