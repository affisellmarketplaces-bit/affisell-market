import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import {
  clearDropForgePendingCommit,
  loadDropForgePendingCommit,
  parseDropForgeCommitIntent,
  saveDropForgePendingCommit,
} from "@/lib/dropforge-pending-commit.shared"

describe("dropforge-pending-commit", () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v)
        },
        removeItem: (k: string) => {
          storage.delete(k)
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("round-trips preview snapshot for auto-commit after signup", () => {
    saveDropForgePendingCommit({
      sourceUrl: "https://www.aliexpress.com/item/1005008719608144.html",
      preview: {
        title: "Test shoe",
        sourceUrl: "https://www.aliexpress.com/item/1005008719608144.html",
        costPrice: 29.59,
        images: ["https://cdn.example/a.jpg"],
      },
      wholesalePrice: "36.99",
      publishLive: true,
    })
    const loaded = loadDropForgePendingCommit()
    expect(loaded?.sourceUrl).toContain("1005008719608144")
    expect(loaded?.wholesalePriceEur).toBe(36.99)
    expect(loaded?.publishLive).toBe(true)
    expect(loaded?.preview.title).toBe("Test shoe")
  })

  it("parses commit intent from query", () => {
    expect(parseDropForgeCommitIntent("live")).toBe("live")
    expect(parseDropForgeCommitIntent("draft")).toBe("draft")
    expect(parseDropForgeCommitIntent("nope")).toBeNull()
  })
})
