import { afterEach, describe, expect, it, vi } from "vitest"

import { sanitizeSupportAgentText } from "@/lib/support/sanitize-agent-links"

describe("sanitizeSupportAgentText", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rewrites localhost URLs to affisell.com in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("AFFISELL_PLATFORM_ORIGIN", "https://affisell.com")
    const input =
      "Suivez votre colis sur http://localhost:3001/track-order ou http://localhost:3001/marketplace/account/orders"
    expect(sanitizeSupportAgentText(input)).toBe(
      "Suivez votre colis sur https://affisell.com/track-order ou https://affisell.com/marketplace/account/orders"
    )
  })

  it("strips BASE placeholder prefix", () => {
    expect(sanitizeSupportAgentText("Voir BASE/help/faq")).toBe("Voir /help/faq")
  })
})
