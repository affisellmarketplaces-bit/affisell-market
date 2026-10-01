import { describe, expect, it } from "vitest"

import {
  parseInvitationCommissionPct,
  SUPPLIER_INVITE_STATUS,
} from "@/lib/supplier-invitation"
import {
  normalizeSupplierInviteToken,
  SUPPLIER_INVITE_TOKEN_PREFIX,
} from "@/lib/supplier-invitation-token"
import {
  buildSupplierInviteSharePayload,
  SUPPLIER_INVITE_MAX_COMMISSION_PCT,
} from "@/lib/supplier-invitation-url"

describe("supplier-invitation", () => {
  it("normalizes invite tokens", () => {
    expect(normalizeSupplierInviteToken("inv-abc123456789")).toBe("INV-ABC123456789")
    expect(normalizeSupplierInviteToken("bad")).toBeNull()
    expect(SUPPLIER_INVITE_TOKEN_PREFIX).toBe("INV-")
  })

  it("parses commission pitch", () => {
    expect(parseInvitationCommissionPct(12.5)).toBe(12.5)
    expect(parseInvitationCommissionPct("15,2")).toBe(15.2)
    expect(parseInvitationCommissionPct("")).toBeNull()
  })

  it("rejects commission above the platform-wide ceiling", () => {
    // Same bound enforced elsewhere (lib/url-import-apply.ts, lib/product-variants.ts,
    // lib/affiliate-buyer-reward.ts) — a proposed commission above it used to pass here, then
    // get silently clamped on the supplier's side with no warning to either party.
    expect(SUPPLIER_INVITE_MAX_COMMISSION_PCT).toBe(50)
    expect(parseInvitationCommissionPct(SUPPLIER_INVITE_MAX_COMMISSION_PCT)).toBe(
      SUPPLIER_INVITE_MAX_COMMISSION_PCT
    )
    expect(parseInvitationCommissionPct(SUPPLIER_INVITE_MAX_COMMISSION_PCT + 0.1)).toBeNull()
    expect(parseInvitationCommissionPct(70)).toBeNull()
    expect(parseInvitationCommissionPct(150)).toBeNull()
  })

  it("builds share URLs", () => {
    const s = buildSupplierInviteSharePayload({
      url: "https://affisell.com/invite/supplier/INV-TEST",
      affiliateName: "Léa",
      headline: "Tech & lifestyle",
    })
    expect(s.whatsapp).toContain("wa.me")
    expect(s.body).toContain("Léa")
    expect(SUPPLIER_INVITE_STATUS.OPEN).toBe("OPEN")
  })

  it("SMS link has no leading '&' before the body param", () => {
    // Some Android SMS clients silently drop the body when the query string starts with "&"
    // instead of the param itself (sms:?&body=... vs sms:?body=...).
    const s = buildSupplierInviteSharePayload({
      url: "https://affisell.com/invite/supplier/INV-TEST",
      affiliateName: "Léa",
    })
    expect(s.sms.startsWith("sms:?body=")).toBe(true)
    expect(s.sms).not.toContain("?&")
  })
})
