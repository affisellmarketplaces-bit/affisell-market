import { describe, expect, it } from "vitest"

import { sanitizeSupportAgentText } from "@/lib/support/sanitize-agent-links"

describe("sanitizeSupportAgentText", () => {
  it("removes localhost origins from assistant links", () => {
    const input =
      "Suivez votre colis sur http://localhost:3001/track-order ou http://localhost:3001/marketplace/account/orders"
    expect(sanitizeSupportAgentText(input)).toBe(
      "Suivez votre colis sur /track-order ou /marketplace/account/orders"
    )
  })

  it("strips BASE placeholder prefix", () => {
    expect(sanitizeSupportAgentText("Voir BASE/help/faq")).toBe("Voir /help/faq")
  })
})
