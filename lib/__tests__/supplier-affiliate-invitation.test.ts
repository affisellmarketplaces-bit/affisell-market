import { describe, expect, it } from "vitest"

import { parseSupplierAffiliateInviteCommissionPct } from "@/lib/supplier-affiliate-invitation"
import {
  normalizeSupplierAffiliateInviteToken,
  SUPPLIER_AFFILIATE_INVITE_TOKEN_PREFIX,
} from "@/lib/supplier-affiliate-invitation-token"
import {
  buildSupplierAffiliateInviteSharePayload,
  SUPPLIER_AFFILIATE_INVITE_MAX_COMMISSION_PCT,
} from "@/lib/supplier-affiliate-invitation-url"

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

  it("rejects commission above the platform-wide ceiling", () => {
    // Same bound enforced elsewhere (lib/url-import-apply.ts, lib/product-variants.ts,
    // lib/affiliate-buyer-reward.ts, and the mirrored lib/supplier-invitation.ts for the
    // affiliate→supplier direction) — a proposed commission above it used to pass here, then
    // persist with no warning to either party.
    expect(SUPPLIER_AFFILIATE_INVITE_MAX_COMMISSION_PCT).toBe(50)
    expect(parseSupplierAffiliateInviteCommissionPct(SUPPLIER_AFFILIATE_INVITE_MAX_COMMISSION_PCT)).toBe(
      SUPPLIER_AFFILIATE_INVITE_MAX_COMMISSION_PCT
    )
    expect(
      parseSupplierAffiliateInviteCommissionPct(SUPPLIER_AFFILIATE_INVITE_MAX_COMMISSION_PCT + 0.1)
    ).toBeNull()
    expect(parseSupplierAffiliateInviteCommissionPct(70)).toBeNull()
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

  it("SMS link has no leading '&' before the body param", () => {
    // Some Android SMS clients silently drop the body when the query string starts with "&"
    // instead of the param itself (sms:?&body=... vs sms:?body=...).
    const p = buildSupplierAffiliateInviteSharePayload({
      url: "https://affisell.com/invite/affiliate/IAF-TEST",
      supplierName: "Acme",
    })
    expect(p.sms.startsWith("sms:?body=")).toBe(true)
    expect(p.sms).not.toContain("?&")
  })
})
