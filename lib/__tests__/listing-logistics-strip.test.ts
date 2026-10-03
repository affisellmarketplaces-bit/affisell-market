import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"

import { ListingLogisticsStrip } from "@/components/product/listing-logistics-strip"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import type { ListingLogisticsInput } from "@/lib/listing-logistics-display"

const logistics: ListingLogisticsInput = {
  shippingCountryCode: "FR",
  shippingCountryLabel: "France",
  warehouseType: "local",
  warehouseCity: "Lyon",
  shipsFromDisplay: null,
  deliveryMin: 2,
  deliveryMax: 5,
  deliveryCountriesSummary: "EU",
}

function render(locale: "en" | "fr", props: Parameters<typeof ListingLogisticsStrip>[0]): string {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: loadAppMessages(locale), timeZone: "UTC" } as ComponentProps<typeof NextIntlClientProvider>,
      createElement(ListingLogisticsStrip, props)
    )
  )
}

describe("ListingLogisticsStrip delivery trust", () => {
  const measured = { sampleSize: 42, medianEndToEndDays: 6, p90EndToEndDays: 9, medianDispatchDays: 1 }

  it("shows measured delivery times (whole days + sample size) when proven", () => {
    const html = render("en", { logistics, measured })
    expect(html).toContain('data-testid="pdp-measured-delivery"')
    expect(html).toContain("Measured delivery: 9 in 10 orders arrive within 9 days (median 6) · 42 recent orders")
  })

  it("speaks the buyer's language", () => {
    const html = render("fr", { logistics, measured })
    expect(html).toContain("Délai mesuré : 9 commandes sur 10 livrées en 9 jours maximum (médiane 6 j) · 42 commandes récentes")
  })

  it("shows no measured line without proven stats", () => {
    expect(render("en", { logistics })).not.toContain("pdp-measured-delivery")
    expect(render("en", { logistics, measured: null })).not.toContain("pdp-measured-delivery")
  })

  it("always states the auto-refund ship guarantee (an enforced site-wide policy), next to returns and payment", () => {
    const html = render("en", { logistics })
    expect(html).toContain("Auto-refund if the seller doesn&#x27;t ship in time")
    expect(html).toContain("14-day returns")
    expect(html).not.toMatch(/pdpTrust\./) // no raw i18n keys
  })
})
