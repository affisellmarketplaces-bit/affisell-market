import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }))

import { AffiliateActionPlanCard } from "@/components/affiliate/affiliate-action-plan-card"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import type { PlannedAction } from "@/lib/reseller-action-plan"

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const
const ALL_REASONS = [
  "supplier_price_at_or_above_selling",
  "net_insufficient",
  "net_thin",
  "refund_rate_rising",
  "supplier_price_changed",
  "cost_drift_up",
  "demand_rising",
  "traffic_without_sales",
  "top_opportunity",
] as const
const TYPES = [
  "reprice",
  "pause",
  "fix_margins",
  "review_refunds",
  "push_momentum",
  "list_opportunity",
  "review_traffic",
  "review_pricing",
] as const

const actions: PlannedAction[] = TYPES.map((type, i) => ({
  id: `${type}:lst_00000${i}`,
  type,
  autonomy: type === "reprice" || type === "pause" || type === "fix_margins" ? "one_click" : "recommend",
  reversible: true,
  listingId: type === "list_opportunity" ? null : `lst_00000${i}`,
  productId: `prod_00000${i}`,
  name: `Produit ${i}`,
  reasons: i === 0 ? [...ALL_REASONS] : [ALL_REASONS[i]!],
  suggestedPriceCents: type === "reprice" ? 5560 : undefined,
  expectedNetNowCents: 396,
  expectedNetAfterCents: 583,
  impactCents: 100,
  trackRecord: i === 0 ? { evaluated: 12, beneficial: 9, successRate: 0.75 } : undefined,
  estimated: true,
}))

function render(locale: (typeof LOCALES)[number], list: PlannedAction[]) {
  return renderToStaticMarkup(
    h(NextIntlClientProvider, {
      locale,
      timeZone: "Europe/Paris",
      messages: loadAppMessages(locale) as AbstractIntlMessages,
      onError: (e: Error) => {
        throw e
      },
      children: h(AffiliateActionPlanCard, { actions: list }),
    }),
  )
}

describe("action plan card", () => {
  it.each(LOCALES)("renders every action type and reason in %s (ICU plurals, price, no raw key)", (locale) => {
    const html = render(locale, actions.slice(0, 6))
    expect(html).not.toMatch(/actionPlan\.|\{count|\{price/)
    expect(html).toContain("Produit 0")
    const last = render(locale, actions.slice(6))
    expect(last).toContain("Produit 6")
  })

  it("one-click actions get an Apply button; recommendations only a link (never a write)", () => {
    const html = render("fr", actions.slice(0, 6))
    expect(html.match(/>Appliquer</g)?.length).toBe(3)
    expect(html).toContain('href="/dashboard/affiliate/products/lst_000000/edit"')
    expect(html).toContain('href="/dashboard/affiliate/catalog?q=Produit%205"')
    expect(html).toContain("jamais un gain garanti")
    expect(html).toContain("Par le passé : 9/12")
  })

  it("renders nothing for an empty plan", () => {
    expect(render("fr", [])).toBe("")
  })
})
