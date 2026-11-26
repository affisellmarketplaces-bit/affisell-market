import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"
import { describe, expect, it } from "vitest"

import { AffiliateAutonomySettings } from "@/components/affiliate/affiliate-autonomy-settings"
import { loadAppMessages } from "@/lib/i18n-load-messages"

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const
const render = (locale: (typeof LOCALES)[number], props: Parameters<typeof AffiliateAutonomySettings>[0]) =>
  renderToStaticMarkup(
    h(NextIntlClientProvider, {
      locale,
      timeZone: "Europe/Paris",
      messages: loadAppMessages(locale) as AbstractIntlMessages,
      onError: (e: Error) => {
        throw e
      },
      children: h(AffiliateAutonomySettings, props),
    }),
  )

describe("autonomy settings", () => {
  it.each(LOCALES)("renders granted and not-granted states in %s", (locale) => {
    const granted = render(locale, {
      available: true,
      rules: [
        {
          actionType: "reprice",
          maxPriceIncreaseBps: 1500,
          maxRunsPerWeek: 3,
          grantedAt: "2026-11-01T00:00:00.000Z",
          revokedAt: null,
        },
      ],
    })
    expect(granted).not.toMatch(/autonomy\.|\{pct|\{runs/)
    expect(render(locale, { available: true, rules: [] })).not.toMatch(/autonomy\.|\{pct|\{runs/)
  })

  it("nothing granted by default; granting needs the consent tick; pausing is never offered", () => {
    const html = render("fr", { available: true, rules: [] })
    expect(html.match(/<button[^>]*disabled=""[^>]*>Autoriser</g)?.length).toBe(2)
    expect(html).toContain("de 10 % au plus par changement, 5 fois par semaine au plus")
    expect(html).not.toMatch(/Mettre en pause/)
    expect(html).toContain("Jamais automatique : mise en pause")
  })

  it("shows the active limits and a revoke button", () => {
    const html = render("fr", {
      available: true,
      rules: [
        {
          actionType: "reprice",
          maxPriceIncreaseBps: 1500,
          maxRunsPerWeek: 3,
          grantedAt: "2026-11-01T00:00:00.000Z",
          revokedAt: null,
        },
      ],
    })
    expect(html).toContain("Activé : +15 % au plus, 3 par semaine au plus")
    expect(html).toContain("Retirer l&#x27;autorisation")
  })
})
