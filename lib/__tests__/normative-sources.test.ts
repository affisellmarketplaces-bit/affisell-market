import { describe, expect, it } from "vitest"

import { normativeUrl, NORMATIVE_SOURCES } from "@/lib/legal/normative-sources"

describe("normative-sources", () => {
  it("exposes Legifrance URLs for French consumer code articles", () => {
    expect(NORMATIVE_SOURCES.L221_28.urlFr).toContain("legifrance.gouv.fr")
    expect(NORMATIVE_SOURCES.L221_18.urlFr).toContain("legifrance.gouv.fr")
    expect(NORMATIVE_SOURCES.L217_4.urlFr).toContain("legifrance.gouv.fr")
  })

  it("exposes EUR-Lex URLs for EU instruments", () => {
    expect(normativeUrl("GDPR", "en")).toContain("eur-lex.europa.eu")
    expect(normativeUrl("DIRECTIVE_2011_83", "en")).toContain("eur-lex.europa.eu")
    expect(normativeUrl("EU_ODR_524_2013", "en")).toContain("ec.europa.eu")
  })

  it("prefers Legifrance for French locale", () => {
    expect(normativeUrl("L221_24", "fr")).toContain("legifrance.gouv.fr")
  })
})
