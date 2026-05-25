import { describe, expect, it } from "vitest"

import {
  parseInvitationCommissionPct,
  SUPPLIER_INVITE_STATUS,
} from "@/lib/supplier-invitation"
import {
  normalizeSupplierInviteToken,
  SUPPLIER_INVITE_TOKEN_PREFIX,
} from "@/lib/supplier-invitation-token"
import { buildSupplierInviteSharePayload } from "@/lib/supplier-invitation-url"

describe("supplier-invitation", () => {
  it("normalizes invite tokens", () => {
    expect(normalizeSupplierInviteToken("inv-abc123456789")).toBe("INV-ABC123456789")
    expect(normalizeSupplierInviteToken("bad")).toBeNull()
    expect(SUPPLIER_INVITE_TOKEN_PREFIX).toBe("INV-")
  })

  it("parses commission pitch", () => {
    expect(parseInvitationCommissionPct(12.5)).toBe(12.5)
    expect(parseInvitationCommissionPct("15,2")).toBe(15.2)
    expect(parseInvitationCommissionPct(150)).toBeNull()
    expect(parseInvitationCommissionPct("")).toBeNull()
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
})
