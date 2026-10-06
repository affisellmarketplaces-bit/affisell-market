import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import en from "@/messages/en.json"
import type { StorePublicUrls } from "@/lib/store-public-url-shared"

// Real message files, with {variable} interpolation — so the test also proves the keys the card reads exist.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, vars?: Record<string, string | number>) => {
    const value = [...namespace.split("."), ...key.split(".")].reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en as unknown as Record<string, unknown>
    )
    if (typeof value !== "string") throw new Error(`missing message ${namespace}.${key}`)
    return value.replace(/\{(\w+)\}/g, (_, n: string) => String(vars?.[n] ?? `{${n}}`))
  },
}))

import { StoreLiveUrlCard } from "@/components/storefront/store-live-url-card"

const urls = (over: Partial<StorePublicUrls>): StorePublicUrls => ({
  primaryUrl: "https://affisell.com/shops/ecom-store",
  subdomainUrl: "https://ecom-store.shops.affisell.com",
  platformPathUrl: "https://affisell.com/shops/ecom-store",
  customDomainUrl: null,
  subdomainSslActive: false,
  subdomainState: "pending",
  ...over,
})

const render = (u: StorePublicUrls) => renderToStaticMarkup(createElement(StoreLiveUrlCard, { urls: u }))

describe("StoreLiveUrlCard subdomain states", () => {
  it("unreachable: says so, points at the working address, and is not presented as the live URL", () => {
    const html = render(urls({ subdomainState: "unreachable" }))
    expect(html).toContain("cannot be opened over HTTPS yet")
    expect(html).toContain("https://affisell.com/shops/ecom-store")
    expect(html).not.toContain("subdomainActive")
  })

  it("pending keeps the original, softer message", () => {
    const html = render(urls({ subdomainState: "pending" }))
    expect(html).not.toContain("cannot be opened over HTTPS yet")
  })

  it("active shows neither warning", () => {
    const html = render(urls({ subdomainState: "active", subdomainSslActive: true, primaryUrl: "https://ecom-store.shops.affisell.com" }))
    expect(html).not.toContain("cannot be opened over HTTPS yet")
  })
})
