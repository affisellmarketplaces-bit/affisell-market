import { describe, expect, it } from "vitest"

import { parseGeneratedBrandStaticPages } from "@/lib/storefront-brand-static-pages.server"

describe("parseGeneratedBrandStaticPages", () => {
  it("parses valid static pages JSON", () => {
    const parsed = parseGeneratedBrandStaticPages(
      JSON.stringify({
        about: { title: "About Nova", body: "We curate premium picks for creators." },
        faq: {
          title: "FAQ",
          faqItems: [
            { question: "Who ships?", answer: "Suppliers fulfill orders." },
            { question: "Returns?", answer: "14-day EU returns on eligible items." },
          ],
        },
        returns: { title: "Returns", body: "Contact support with your order number within 14 days." },
      })
    )
    expect(parsed?.about.enabled).toBe(true)
    expect(parsed?.faq.faqItems?.length).toBe(2)
    expect(parsed?.returns.body).toContain("14 days")
  })

  it("rejects incomplete JSON", () => {
    expect(parseGeneratedBrandStaticPages(JSON.stringify({ about: { body: "Only about" } }))).toBeNull()
  })
})
