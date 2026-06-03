import { describe, expect, it } from "vitest"

import {
  isExternalPlaybookUrl,
  sentinelPlaybookKind,
  sentinelPlaybookLabel,
  sentinelPlaybookUrl,
} from "@/lib/sentinel/sentinel-shared"

describe("sentinelPlaybookKind", () => {
  it("marks retry-auto-buy as action", () => {
    expect(sentinelPlaybookKind("retry-auto-buy")).toBe("action")
  })

  it("marks admin links as link", () => {
    expect(sentinelPlaybookKind("open-auto-fulfill")).toBe("link")
    expect(sentinelPlaybookKind("open-sentry")).toBe("link")
  })
})

describe("sentinelPlaybookUrl", () => {
  it("builds sentry external url from entityId", () => {
    expect(
      sentinelPlaybookUrl("open-sentry", "https://affisell.sentry.io/issues/123/")
    ).toBe("https://affisell.sentry.io/issues/123/")
  })

  it("builds order admin url", () => {
    expect(sentinelPlaybookUrl("open-order", "ord_abc")).toBe("/admin/orders/ord_abc")
  })
})

describe("isExternalPlaybookUrl", () => {
  it("detects https links", () => {
    expect(isExternalPlaybookUrl("https://sentry.io/issues/1/")).toBe(true)
    expect(isExternalPlaybookUrl("/admin/orders")).toBe(false)
  })
})

describe("sentinelPlaybookLabel", () => {
  it("labels retry playbook", () => {
    expect(sentinelPlaybookLabel("retry-auto-buy")).toBe("Retry auto-buy")
  })
})
