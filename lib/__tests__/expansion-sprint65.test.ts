import { describe, expect, it } from "vitest"

import {
  buildExpansionAdminPathWithMultiAlertFilter,
  EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY,
  parseExpansionAdminMultiAlertFilter,
  readExpansionAdminMultiAlertFilterFromSearchParams,
  writeExpansionAdminMultiAlertFilterToSearchParams,
} from "@/lib/expansion/expansion-admin-multi-alert-filter"

describe("parseExpansionAdminMultiAlertFilter", () => {
  it("accepts 1 and true", () => {
    expect(parseExpansionAdminMultiAlertFilter("1")).toBe(true)
    expect(parseExpansionAdminMultiAlertFilter("true")).toBe(true)
  })

  it("rejects other values", () => {
    expect(parseExpansionAdminMultiAlertFilter("0")).toBe(false)
    expect(parseExpansionAdminMultiAlertFilter(null)).toBe(false)
  })
})

describe("writeExpansionAdminMultiAlertFilterToSearchParams", () => {
  it("sets and clears multiAlert query param", () => {
    const enabled = writeExpansionAdminMultiAlertFilterToSearchParams(new URLSearchParams(), true)
    expect(enabled.get(EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY)).toBe("1")

    const disabled = writeExpansionAdminMultiAlertFilterToSearchParams(enabled, false)
    expect(disabled.get(EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY)).toBe("0")
  })

  it("preserves unrelated query params", () => {
    const base = new URLSearchParams("foo=bar")
    const next = writeExpansionAdminMultiAlertFilterToSearchParams(base, true)
    expect(next.get("foo")).toBe("bar")
    expect(next.get(EXPANSION_ADMIN_MULTI_ALERT_QUERY_KEY)).toBe("1")
  })
})

describe("buildExpansionAdminPathWithMultiAlertFilter", () => {
  it("builds bookmarkable admin expansion paths", () => {
    expect(
      buildExpansionAdminPathWithMultiAlertFilter(
        "/admin/expansion",
        new URLSearchParams(),
        true
      )
    ).toBe("/admin/expansion?multiAlert=1")

    expect(
      buildExpansionAdminPathWithMultiAlertFilter(
        "/admin/expansion",
        new URLSearchParams("multiAlert=1"),
        false
      )
    ).toBe("/admin/expansion?multiAlert=0")
  })
})

describe("readExpansionAdminMultiAlertFilterFromSearchParams", () => {
  it("reads multi-alert filter from search params", () => {
    expect(
      readExpansionAdminMultiAlertFilterFromSearchParams(
        new URLSearchParams("multiAlert=1")
      )
    ).toBe(true)
  })
})
