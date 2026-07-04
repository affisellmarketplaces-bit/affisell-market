import { describe, expect, it } from "vitest"

import {
  buildDefaultStaticPages,
  getEnabledStaticPages,
  parseStaticPages,
  updateStaticPage,
} from "@/lib/storefront-static-pages-shared"

describe("storefront-static-pages-shared", () => {
  it("parses enabled flags and trims copy", () => {
    const pages = parseStaticPages({
      about: { enabled: true, title: "  About us  ", body: "Hello" },
      faq: {
        enabled: true,
        faqItems: [{ question: "Q?", answer: "A." }],
      },
    })
    expect(pages.about.enabled).toBe(true)
    expect(pages.about.title).toBe("About us")
    expect(pages.faq.faqItems).toHaveLength(1)
    expect(getEnabledStaticPages(pages)).toEqual(["about", "faq"])
  })

  it("updates a page immutably", () => {
    const base = buildDefaultStaticPages({ storeName: "Demo" })
    const next = updateStaticPage(base, "about", { body: "Updated" })
    expect(next.about.body).toBe("Updated")
    expect(base.about.body).not.toBe("Updated")
  })
})
