import { describe, expect, it } from "vitest"

import {
  generateSupplierExtensionPlainToken,
  hashSupplierExtensionToken,
  isSupplierExtensionPlainToken,
} from "@/lib/supplier-extension-token"

describe("supplier-extension-token", () => {
  it("generates prefixed tokens", () => {
    const t = generateSupplierExtensionPlainToken()
    expect(isSupplierExtensionPlainToken(t)).toBe(true)
    expect(t.startsWith("afs_ext_")).toBe(true)
  })

  it("hashes deterministically", () => {
    const a = hashSupplierExtensionToken("afs_ext_test123")
    const b = hashSupplierExtensionToken("afs_ext_test123")
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })
})
