import { describe, expect, it } from "vitest"

import { storePublicUrl } from "@/lib/store-public-url"

// The domain-status API exposes `platformStoreUrl` = storePublicUrl with the custom domain stripped. This pins the premise:
// a DNS-verified custom domain becomes the primary URL immediately (before HTTPS), so the Affisell address needs its own field.
describe("store public URL vs the Affisell address", () => {
  const base = { slug: "aurore", role: "AFFILIATE" as const }

  it("a verified custom domain takes over the primary URL", () => {
    expect(storePublicUrl({ ...base, customDomain: "Boutique-Aurore.com", domainVerified: true })).toBe(
      "https://boutique-aurore.com"
    )
  })

  it("an unverified domain does not", () => {
    expect(storePublicUrl({ ...base, customDomain: "boutique-aurore.com", domainVerified: false })).not.toContain(
      "boutique-aurore.com"
    )
  })

  it("with the custom domain stripped, the address is on Affisell and carries the slug", () => {
    const url = storePublicUrl({ ...base, customDomain: null, domainVerified: false })
    expect(url).toContain("aurore")
    expect(url).not.toContain("boutique-aurore.com")
  })

  it("suppliers get their own platform path", () => {
    expect(storePublicUrl({ slug: "acme", role: "SUPPLIER", customDomain: null })).toContain("acme")
  })
})
