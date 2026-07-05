import { describe, expect, it } from "vitest"

import {
  isCustomDomainFullyActive,
  resolveCustomDomainActivationState,
} from "@/lib/custom-domain-activation-shared"

describe("resolveCustomDomainActivationState", () => {
  it("returns needs_domain when no custom domain", () => {
    expect(
      resolveCustomDomainActivationState({
        customDomain: null,
        domainVerified: false,
        vercelDomainStatus: null,
      })
    ).toBe("needs_domain")
  })

  it("returns needs_dns when domain saved but not verified", () => {
    expect(
      resolveCustomDomainActivationState({
        customDomain: "shop.example.com",
        domainVerified: false,
        vercelDomainStatus: null,
      })
    ).toBe("needs_dns")
  })

  it("returns needs_ssl when DNS verified but Vercel pending", () => {
    expect(
      resolveCustomDomainActivationState({
        customDomain: "shop.example.com",
        domainVerified: true,
        vercelDomainStatus: "pending",
      })
    ).toBe("needs_ssl")
  })

  it("returns active when domain verified and Vercel active", () => {
    expect(
      isCustomDomainFullyActive({
        customDomain: "shop.example.com",
        domainVerified: true,
        vercelDomainStatus: "active",
      })
    ).toBe(true)
  })
})
