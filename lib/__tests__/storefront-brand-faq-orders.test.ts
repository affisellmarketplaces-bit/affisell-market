import { describe, expect, it } from "vitest"

import { parseGeneratedBrandFaqItems } from "@/lib/storefront-brand-faq-orders.server"

describe("parseGeneratedBrandFaqItems", () => {
  it("parses faq items array", () => {
    const items = parseGeneratedBrandFaqItems(
      JSON.stringify({
        faqItems: [
          { question: "How long is shipping?", answer: "Most orders ship in 2-5 business days." },
          { question: "Can I return?", answer: "Yes — 14-day EU returns on eligible items." },
        ],
      })
    )
    expect(items?.length).toBe(2)
  })
})
