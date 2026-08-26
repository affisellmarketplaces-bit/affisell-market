import { describe, expect, it } from "vitest"

import {
  GTAG_CONSENT_DEFAULT_SCRIPT,
  GTAG_CONSENT_SCRIPT_ID,
} from "@/lib/legal/cookie-consent-gtag-bootstrap"

describe("cookie-consent-gtag-bootstrap", () => {
  it("defines consent default with denied storage", () => {
    expect(GTAG_CONSENT_DEFAULT_SCRIPT).toContain("analytics_storage: 'denied'")
    expect(GTAG_CONSENT_DEFAULT_SCRIPT).toContain("gtag('consent', 'default'")
  })

  it("uses stable script id for idempotent injection", () => {
    expect(GTAG_CONSENT_SCRIPT_ID).toBe("gtag-consent-default")
  })
})
