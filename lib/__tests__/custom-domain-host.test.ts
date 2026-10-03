import { describe, expect, it } from "vitest"

import { isPlatformHost, normalizeRequestHost } from "@/lib/custom-domain-host"
import {
  isMerchantPublicPlatformPath,
  isStoreBuyerFlowPath,
  mapCustomDomainPath,
  storePublicPrefix,
} from "@/lib/custom-domain-path"

describe("normalizeRequestHost", () => {
  it("strips port and normalizes", () => {
    expect(normalizeRequestHost("Shop.Example.COM:443")).toBe("shop.example.com")
  })
})

describe("isPlatformHost", () => {
  it("treats localhost and vercel preview as platform", () => {
    expect(isPlatformHost("localhost")).toBe(true)
    expect(isPlatformHost("affisell-market.vercel.app")).toBe(true)
  })

  it("treats merchant domains as non-platform", () => {
    expect(isPlatformHost("boutique-createur.fr")).toBe(false)
  })

  it("treats auto store subdomains as non-platform even on .localhost", () => {
    expect(isPlatformHost("ecom-store.shops.localhost")).toBe(false)
    expect(isPlatformHost("marie-store.shops.affisell.com")).toBe(false)
  })
})

describe("mapCustomDomainPath", () => {
  it("maps affiliate root and product paths", () => {
    const slug = "my-shop"
    expect(mapCustomDomainPath("/", slug, "AFFILIATE")).toBe(storePublicPrefix(slug, "AFFILIATE"))
    expect(mapCustomDomainPath("/product/abc", slug, "AFFILIATE")).toBe(
      `/shops/${slug}/product/abc`
    )
  })

  it("keeps cart on affiliate custom domain", () => {
    expect(mapCustomDomainPath("/cart", "my-shop", "AFFILIATE")).toBe("/cart")
  })

  it("keeps the post-purchase pages on the reseller's host instead of the store home", () => {
    // Stripe returns the buyer to the origin they paid from — /success must resolve there.
    expect(mapCustomDomainPath("/success", "my-shop", "AFFILIATE")).toBe("/success")
    expect(mapCustomDomainPath("/track-order", "my-shop", "AFFILIATE")).toBe("/track-order")
    expect(isStoreBuyerFlowPath("/success")).toBe(true)
    expect(isStoreBuyerFlowPath("/success-story")).toBe(false)
    expect(isStoreBuyerFlowPath("/order-success")).toBe(false)
  })

  it("does not expose buyer-flow pages on supplier storefronts", () => {
    expect(mapCustomDomainPath("/success", "acme", "SUPPLIER")).toBe(storePublicPrefix("acme", "SUPPLIER"))
  })

  it("keeps legal pages on affiliate custom domain", () => {
    expect(mapCustomDomainPath("/legal/legal-notice", "my-shop", "AFFILIATE")).toBe(
      "/legal/legal-notice"
    )
    expect(mapCustomDomainPath("/support", "my-shop", "AFFILIATE")).toBe("/support")
  })

  it("detects merchant public platform paths", () => {
    expect(isMerchantPublicPlatformPath("/legal/returns")).toBe(true)
    expect(isMerchantPublicPlatformPath("/dashboard")).toBe(false)
  })

  it("maps supplier product paths", () => {
    const slug = "acme"
    expect(mapCustomDomainPath("/product/p1", slug, "SUPPLIER")).toBe(
      `/store/supplier/${slug}/product/p1`
    )
  })

  it("blocks dashboard on custom domain", () => {
    expect(mapCustomDomainPath("/dashboard/supplier", "x", "SUPPLIER")).toBe(null)
  })
})
