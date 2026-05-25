import { describe, expect, it } from "vitest"

import { parseSupplierAffiliateInviteCommissionPct } from "@/lib/supplier-affiliate-invitation"
import {
  normalizeSupplierAffiliateInviteToken,
  SUPPLIER_AFFILIATE_INVITE_TOKEN_PREFIX,
} from "@/lib/supplier-affiliate-invitation-token"
import { buildSupplierAffiliateInviteSharePayload } from "@/lib/supplier-affiliate-invitation-url"

describe("supplier-affiliate-invitation", () => {
  it("normalizes IAF tokens", () => {
    expect(normalizeSupplierAffiliateInviteToken("iaf-abc123456789")).toBe("IAF-ABC123456789")
    expect(normalizeSupplierAffiliateInviteToken("INV-WRONG")).toBeNull()
    expect(SUPPLIER_AFFILIATE_INVITE_TOKEN_PREFIX).toBe("IAF-")
  })

  it("parses commission pitch", () => {
    expect(parseSupplierAffiliateInviteCommissionPct("12,5")).toBe(12.5)
    expect(parseSupplierAffiliateInviteCommissionPct(200)).toBeNull()
  })

  it("builds share payload", () => {
    const p = buildSupplierAffiliateInviteSharePayload({
      url: "https://affisell.com/invite/affiliate/IAF-TEST",
      supplierName: "Acme",
      headline: "Join my catalog",
    })
    expect(p.body).toContain("Acme")
    expect(p.whatsapp).toContain("wa.me")
  })
})
