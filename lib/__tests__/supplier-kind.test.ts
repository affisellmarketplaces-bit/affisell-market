import { describe, expect, it } from "vitest"

import {
  getSupplierKindLabel,
  isProducer,
  isStocker,
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
    expect(getSupplierKindLabel("stocker")).toBe("Stockeur")
  })
})
