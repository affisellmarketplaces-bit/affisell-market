import fs from "node:fs"
import path from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

const intl = vi.hoisted(() => ({ locale: "en" as "en" | "fr" }))

// Resolve strings from the REAL message files (with {variable} interpolation) so the test also proves the keys exist.
vi.mock("next-intl", () => ({
  useLocale: () => intl.locale,
  useTranslations: (namespace: string) => (key: string, vars?: Record<string, string | number>) => {
    const messages = (intl.locale === "en" ? en : fr) as unknown as Record<string, unknown>
    const value = [...namespace.split("."), ...key.split(".")].reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      messages
    )
    if (typeof value !== "string") throw new Error(`missing message ${namespace}.${key}`)
    return value.replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`))
  },
}))

// ProductCard's links / wishlist heart pull in next-intl's locale navigation, which needs the Next runtime.
vi.mock("@/components/navigation/fast-link", () => ({ FastLink: () => null }))
vi.mock("@/components/wishlist-heart", () => ({ WishlistHeart: () => null }))

import { CustomerConversionBadges } from "@/components/product/ProductCard"

const render = (priceCents: number, extra: Partial<{ freeShipping: boolean }> = {}, locale: "en" | "fr" = "en") => {
  intl.locale = locale
  return renderToStaticMarkup(
    createElement(CustomerConversionBadges, {
      freeShipping: extra.freeShipping ?? false,
      warrantyLabel: null,
      warrantyMonths: null,
      priceCents,
    })
  )
}

describe("Klarna chip on product cards", () => {
  beforeEach(() => {
    delete process.env.MARKETPLACE_BNPL_ENABLED
  })
  afterEach(() => {
    delete process.env.MARKETPLACE_BNPL_ENABLED
  })

  it("shows Klarna once the price reaches the checkout minimum, with the per-installment amount", () => {
    const html = render(149_99)
    expect(html).toContain("Klarna")
    expect(html).toMatch(/title="Pay in 3 × [^"]*50[.,]00[^"]*with Klarna"/) // ceil(149.99 / 3) = 50.00
    expect(html).toContain("#FFB3C7") // Klarna pink, same as the checkout badge
  })

  it("does not promise Klarna below the minimum — checkout would not offer it", () => {
    expect(render(12_00)).toBe("") // nothing else to show either
    expect(render(34_99)).not.toContain("Klarna")
    expect(render(35_00)).toContain("Klarna")
  })

  it("does not promise Klarna when BNPL is switched off", () => {
    process.env.MARKETPLACE_BNPL_ENABLED = "0"
    expect(render(149_99, { freeShipping: true })).not.toContain("Klarna")
    expect(render(149_99, { freeShipping: true })).toContain("Free delivery")
  })

  it("keeps the other chips and renders in French", () => {
    const html = render(149_99, { freeShipping: true }, "fr")
    expect(html).toContain("Livraison offerte")
    expect(html).toContain("avec Klarna")
    expect(html).not.toContain("Paiement 3x")
  })

  it("the old hard-coded label is gone from the sources", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../components/product/ProductCard.tsx"), "utf8")
    expect(src).not.toContain("Paiement 3x")
  })
})
