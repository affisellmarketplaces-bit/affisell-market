import fs from "node:fs"

import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"
import { describe, expect, it } from "vitest"

import { AffiliateListingHealthCard } from "@/components/affiliate/affiliate-listing-health-card"
import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import { evaluateListingHealth } from "@/lib/reseller-opportunity-score"
import { estimateRefundRisk } from "@/lib/reseller-refund-risk"

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const

const eco = buildAffiliateCatalogCardEconomics(5000, 10, { listedSellingPriceCents: 4900 })
const bad = {
  ...evaluateListingHealth({
    listingId: "l_bad",
    productId: "p_bad",
    sellingPriceCents: 4900,
    supplierPriceCents: 5000,
    netGainCents: eco.netPartnerGainCents,
    refundRisk: estimateRefundRisk({}),
  }),
  name: "Lampe",
  sellingPriceCents: 4900,
  supplierPriceCents: 5000,
  commissionRatePct: 10,
  netGainCents: eco.netPartnerGainCents,
}

function render(locale: (typeof LOCALES)[number], listings: (typeof bad)[]) {
  return renderToStaticMarkup(
    h(NextIntlClientProvider, {
      locale,
      timeZone: "Europe/Paris",
      messages: loadAppMessages(locale) as AbstractIntlMessages,
      onError: (e: Error) => {
        throw e
      },
      children: h(AffiliateListingHealthCard, { listings }),
    }),
  )
}

describe("listing health card", () => {
  it.each(LOCALES)("renders real strings in %s (ICU plurals parse, no raw key)", (locale) => {
    for (const listings of [[bad], [bad, { ...bad, listingId: "l2" }, { ...bad, listingId: "l3" }]]) {
      const html = render(locale, listings)
      expect(html).toContain("Lampe")
      expect(html).not.toMatch(/listingHealth\.|\{count|\{selling/)
    }
  })

  it("links each flagged listing to its edit page and the footer to an existing route (never a 404)", () => {
    const html = render("fr", [bad])
    expect(html).toContain('href="/dashboard/affiliate/products/l_bad/edit"')
    expect(html).toContain('href="/dashboard/affiliate/catalog"')
    expect(fs.existsSync("app/dashboard/affiliate/products/[id]/edit/page.tsx")).toBe(true)
    expect(fs.existsSync("app/dashboard/affiliate/catalog/page.tsx")).toBe(true)
    expect(fs.existsSync("app/dashboard/affiliate/products/page.tsx")).toBe(false)
  })

  it("renders nothing when every listing is healthy", () => {
    expect(render("fr", [{ ...bad, status: "ok", issues: [] }])).toBe("")
  })
})
