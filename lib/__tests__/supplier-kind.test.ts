import { describe, expect, it } from "vitest"

import {
  getRadarCockpit,
  getSupplierKindAnalyticsProps,
  getSupplierKindDisplaySlug,
  getSupplierKindLabel,
  isProducer,
  isStocker,
  needsSupplierKindOnboarding,
  parseSupplierKind,
} from "@/lib/supplier-kind"

describe("supplier-kind", () => {
  it("defaults unknown values to unset", () => {
    expect(parseSupplierKind(null)).toBe("unset")
    expect(parseSupplierKind("nope")).toBe("unset")
  })

  it("detects producer and stocker", () => {
    expect(isProducer({ supplierKind: "producer" })).toBe(true)
    expect(isStocker({ supplierKind: "stocker" })).toBe(true)
    expect(isProducer({ supplierKind: "unset" })).toBe(false)
  })

  it("labels FR UI strings", () => {
    expect(getSupplierKindLabel("unset")).toBe("Non défini")
    expect(getSupplierKindLabel("producer")).toBe("Producteur")
    expect(getSupplierKindLabel("stocker")).toBe("Grossiste")
  })

  it("maps display_kind for analytics without renaming DB values", () => {
    expect(getSupplierKindDisplaySlug("stocker")).toBe("grossiste")
    expect(getSupplierKindAnalyticsProps("stocker")).toEqual({
      kind: "stocker",
      display_kind: "grossiste",
    })
    expect(getSupplierKindAnalyticsProps("producer")).toEqual({
      kind: "producer",
      display_kind: "producteur",
    })
  })

  it("maps Radar cockpit + onboarding flag", () => {
    expect(getRadarCockpit("producer")).toBe("defense")
    expect(getRadarCockpit("stocker")).toBe("attaque")
    expect(getRadarCockpit("unset")).toBeNull()
    expect(needsSupplierKindOnboarding("unset")).toBe(true)
    expect(needsSupplierKindOnboarding("producer")).toBe(false)
  })
})
