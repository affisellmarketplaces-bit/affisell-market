import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"
import { describe, expect, it } from "vitest"

import { AffiliateCopilotResultsCard } from "@/components/affiliate/affiliate-copilot-results-card"
import { accountOrder, summariseAccuracy } from "@/lib/copilot-accuracy"
import { loadAppMessages } from "@/lib/i18n-load-messages"

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const
const rows = Array.from({ length: 40 }, (_, i) =>
  accountOrder({
    orderId: `ord_${i}`,
    categoryId: "c",
    supplierId: "s",
    estimatedCents: 1000 + (i % 2 ? 10 : -10),
    settledCents: 1000,
    clawbackCents: 0,
    voided: false,
    transferredCents: i < 30 ? 1000 : 0,
    reversedCents: 0,
    recordedNotTransferredCents: 0,
    payable: true,
    refunded: false,
    expectedRefundRate: 0.1,
  }),
)
const outcomes = (["beneficial", "neutral", "unfavourable", "insufficient_data", "too_early"] as const).map(
  (verdict, i) => ({
    auditId: `aud_${i}`,
    type: ["reprice", "pause", "fix_margins", "reprice", "other"][i]!,
    appliedAt: "2026-10-01T00:00:00.000Z",
    outcome: { verdict },
  }),
)

function render(locale: (typeof LOCALES)[number], props: Parameters<typeof AffiliateCopilotResultsCard>[0]) {
  return renderToStaticMarkup(
    h(NextIntlClientProvider, {
      locale,
      timeZone: "Europe/Paris",
      messages: loadAppMessages(locale) as AbstractIntlMessages,
      onError: (e: Error) => {
        throw e
      },
      children: h(AffiliateCopilotResultsCard, props),
    }),
  )
}

describe("copilot results card", () => {
  it.each(LOCALES)("renders every verdict and the four amounts in %s", (locale) => {
    for (const accuracy of [summariseAccuracy(rows), summariseAccuracy(rows.slice(0, 3))]) {
      const html = render(locale, { accuracy, outcomes })
      expect(html).not.toMatch(/copilotResults\.|\{orders|\{mae|\{min/)
    }
  })

  it("keeps estimated, due, paid and still-owed apart", () => {
    const html = render("fr", { accuracy: summariseAccuracy(rows), outcomes: [] })
    expect(html).toContain("Estimé")
    expect(html).toContain("Dû (calculé)")
    expect(html).toContain("Versé")
    expect(html).toContain("Reste dû")
    expect(html).toContain("fiables sur vos 40 ventes")
  })

  it("renders nothing without any data", () => {
    expect(render("fr", { accuracy: summariseAccuracy([]), outcomes: [] })).toBe("")
  })
})
