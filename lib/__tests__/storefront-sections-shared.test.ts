import { describe, expect, it } from "vitest"

import {
  DEFAULT_HOMEPAGE_SECTIONS,
  getEnabledHomepageSections,
  homepageSectionsEqual,
  moveHomepageSection,
  parseHomepageSections,
  parseHomepageSectionsFromJson,
  reorderHomepageSections,
  toggleHomepageSection,
} from "@/lib/storefront-sections-shared"

describe("parseHomepageSections", () => {
  it("returns defaults when raw is missing", () => {
    expect(parseHomepageSections(undefined)).toEqual(DEFAULT_HOMEPAGE_SECTIONS)
    expect(parseHomepageSections(null)).toEqual(DEFAULT_HOMEPAGE_SECTIONS)
    expect(parseHomepageSections("bad")).toEqual(DEFAULT_HOMEPAGE_SECTIONS)
  })

  it("parses enabled flags and dedupes types", () => {
    const parsed = parseHomepageSections([
      { type: "products", enabled: false },
      { type: "products", enabled: true },
      { type: "hero", enabled: false },
      { type: "unknown", enabled: true },
    ])
    expect(parsed.find((s) => s.type === "products")?.enabled).toBe(false)
    expect(parsed.find((s) => s.type === "hero")?.enabled).toBe(false)
    expect(parsed.filter((s) => s.type === "products")).toHaveLength(1)
    expect(parsed.map((s) => s.type)).toEqual([
      "products",
      "hero",
      "flash-sale",
      "story",
      "bestsellers",
      "social-proof",
      "trust",
      "newsletter",
      "cta",
    ])
  })

  it("defaults enabled to true when omitted", () => {
    const parsed = parseHomepageSections([{ type: "cta" }])
    expect(parsed.find((s) => s.type === "cta")?.enabled).toBe(true)
  })

  it("parses section content", () => {
    const parsed = parseHomepageSections([
      {
        type: "cta",
        enabled: true,
        content: { title: "Join us", buttonHref: "/discover" },
      },
    ])
    const cta = parsed.find((s) => s.type === "cta")
    expect(cta?.content?.title).toBe("Join us")
    expect(cta?.content?.buttonHref).toBe("/discover")
  })
})

describe("homepage section helpers", () => {
  const sample = parseHomepageSections([
    { type: "story", enabled: true },
    { type: "hero", enabled: false },
    { type: "products", enabled: true },
  ])

  it("filters enabled sections", () => {
    expect(getEnabledHomepageSections(sample).map((s) => s.type)).toEqual([
      "story",
      "products",
      "trust",
    ])
  })

  it("toggles a section", () => {
    const next = toggleHomepageSection(sample, "hero", true)
    expect(next.find((s) => s.type === "hero")?.enabled).toBe(true)
  })

  it("moves sections up and down", () => {
    const up = moveHomepageSection(sample, 1, "up")
    expect(up.map((s) => s.type)).toEqual([
      "hero",
      "story",
      "products",
      "flash-sale",
      "bestsellers",
      "social-proof",
      "trust",
      "newsletter",
      "cta",
    ])
    const down = moveHomepageSection(up, 0, "down")
    expect(down.map((s) => s.type)).toEqual([
      "story",
      "hero",
      "products",
      "flash-sale",
      "bestsellers",
      "social-proof",
      "trust",
      "newsletter",
      "cta",
    ])
  })

  it("reorders sections by drag indices", () => {
    const base = parseHomepageSections([
      { type: "hero", enabled: true },
      { type: "products", enabled: true },
      { type: "trust", enabled: true },
    ])
    const reordered = reorderHomepageSections(base, 2, 0)
    expect(reordered.map((s) => s.type).slice(0, 3)).toEqual(["trust", "hero", "products"])
    expect(reorderHomepageSections(base, 0, 0)).toBe(base)
  })

  it("compares section arrays", () => {
    const a = parseHomepageSections([{ type: "hero", enabled: true }])
    const b = parseHomepageSections([{ type: "hero", enabled: true }])
    expect(homepageSectionsEqual(a, b)).toBe(true)
    expect(homepageSectionsEqual(a, toggleHomepageSection(a, "cta", true))).toBe(false)
  })

  it("parses JSON strings safely", () => {
    const json = JSON.stringify([{ type: "trust", enabled: false }])
    const parsed = parseHomepageSectionsFromJson(json)
    expect(parsed.find((s) => s.type === "trust")?.enabled).toBe(false)
    expect(parseHomepageSectionsFromJson("{bad")).toEqual(DEFAULT_HOMEPAGE_SECTIONS)
  })
})
