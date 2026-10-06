import { describe, expect, it } from "vitest"

import {
  deriveBrandDomainStage,
  deriveStorefrontMode,
  displayStoreAddress,
} from "@/lib/storefront/storefront-mode"

describe("deriveStorefrontMode", () => {
  it("no custom domain → vitrine, nothing started", () => {
    for (const customDomain of [undefined, null, "", "   "]) {
      const info = deriveStorefrontMode({ customDomain })
      expect(info.mode).toBe("vitrine")
      expect(info.stage).toBe("none")
      expect(info.domain).toBeNull()
      expect(info.steps.map((s) => [s.id, s.done, s.current])).toEqual([
        ["domain", false, true],
        ["dns", false, false],
        ["https", false, false],
      ])
    }
  })

  it("a domain that is typed in but not DNS-verified is still a vitrine", () => {
    const info = deriveStorefrontMode({ customDomain: "Boutique-Aurore.com", domainVerified: false })
    expect(info.mode).toBe("vitrine")
    expect(info.stage).toBe("dns_pending")
    expect(info.domain).toBe("boutique-aurore.com")
    expect(info.steps.map((s) => s.done)).toEqual([true, false, false])
    expect(info.steps.find((s) => s.current)?.id).toBe("dns")
  })

  it("verified DNS but certificate not issued yet → still a vitrine, HTTPS is the open step", () => {
    for (const vercelDomainStatus of ["pending", "registered", null, undefined, "something-new"]) {
      const info = deriveStorefrontMode({
        customDomain: "shop.example.com",
        domainVerified: true,
        vercelDomainStatus,
        vercelAutoProvision: true,
      })
      expect(info.mode, String(vercelDomainStatus)).toBe("vitrine")
      expect(info.stage).toBe("ssl_pending")
      expect(info.steps.find((s) => s.current)?.id).toBe("https")
    }
  })

  it("a failed certificate is surfaced as such, not hidden as 'pending'", () => {
    const info = deriveStorefrontMode({
      customDomain: "shop.example.com",
      domainVerified: true,
      vercelDomainStatus: "failed",
      vercelAutoProvision: true,
    })
    expect(info.mode).toBe("vitrine")
    expect(info.stage).toBe("ssl_failed")
  })

  it("verified + certificate active → brand, every step done", () => {
    const info = deriveStorefrontMode({
      customDomain: "shop.example.com",
      domainVerified: true,
      vercelDomainStatus: "active",
      vercelAutoProvision: true,
    })
    expect(info.mode).toBe("brand")
    expect(info.stage).toBe("live")
    expect(info.steps.every((s) => s.done)).toBe(true)
    expect(info.steps.some((s) => s.current)).toBe(false)
  })

  it("when certificates are not managed automatically, a verified DNS is enough", () => {
    expect(
      deriveBrandDomainStage({ customDomain: "shop.example.com", domainVerified: true, vercelAutoProvision: false })
    ).toBe("live")
    expect(
      deriveBrandDomainStage({ customDomain: "shop.example.com", domainVerified: true, vercelDomainStatus: "skipped" })
    ).toBe("live")
  })

  it("an unverified domain is never brand, whatever the certificate row says", () => {
    expect(
      deriveStorefrontMode({ customDomain: "shop.example.com", domainVerified: false, vercelDomainStatus: "active" }).mode
    ).toBe("vitrine")
  })

  it("exactly one step is current until the store is brand", () => {
    const stages = [
      { customDomain: null },
      { customDomain: "a.co", domainVerified: false },
      { customDomain: "a.co", domainVerified: true, vercelDomainStatus: "pending", vercelAutoProvision: true },
    ]
    for (const s of stages) expect(deriveStorefrontMode(s).steps.filter((x) => x.current)).toHaveLength(1)
  })
})

describe("displayStoreAddress", () => {
  it("shows host (and path for platform URLs) without protocol or trailing slash", () => {
    expect(displayStoreAddress("https://shop.example.com/")).toBe("shop.example.com")
    expect(displayStoreAddress("https://aurore.shops.affisell.com")).toBe("aurore.shops.affisell.com")
    expect(displayStoreAddress("https://affisell.com/shops/aurore")).toBe("affisell.com/shops/aurore")
    expect(displayStoreAddress(null)).toBeNull()
    expect(displayStoreAddress("not a url")).toBe("not a url")
  })
})
