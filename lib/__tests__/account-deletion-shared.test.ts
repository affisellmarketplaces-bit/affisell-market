import { describe, expect, it } from "vitest"

import {
  isAccountDeletionConfirmed,
  normalizeAccountDeletionEmail,
  parseAccountDeletionReason,
} from "@/lib/account-deletion-shared"

describe("account-deletion-shared", () => {
  it("normalizes email for comparison", () => {
    expect(normalizeAccountDeletionEmail("  User@Example.COM ")).toBe("user@example.com")
  })

  it("accepts matching confirmEmail", () => {
    expect(
      isAccountDeletionConfirmed({ confirmEmail: "User@Test.com" }, "user@test.com")
    ).toBe(true)
  })

  it("rejects mismatched confirmEmail", () => {
    expect(isAccountDeletionConfirmed({ confirmEmail: "other@test.com" }, "user@test.com")).toBe(
      false
    )
  })

  it("accepts legacy DELETE token when confirmEmail absent", () => {
    expect(isAccountDeletionConfirmed({ confirm: "DELETE" }, "user@test.com")).toBe(true)
  })

  it("rejects empty confirmation", () => {
    expect(isAccountDeletionConfirmed({}, "user@test.com")).toBe(false)
    expect(isAccountDeletionConfirmed({ confirmEmail: "   " }, "user@test.com")).toBe(false)
  })

  it("requires a reason code", () => {
    expect(parseAccountDeletionReason({})).toEqual({ ok: false, code: "REASON_REQUIRED" })
  })

  it("requires detail for other reason", () => {
    expect(parseAccountDeletionReason({ reasonCode: "other", reasonDetail: "short" })).toEqual({
      ok: false,
      code: "REASON_DETAIL_REQUIRED",
    })
  })

  it("accepts valid reason with optional detail", () => {
    expect(
      parseAccountDeletionReason({
        reasonCode: "missing_features",
        reasonDetail: "Need bulk CSV import",
      })
    ).toEqual({
      ok: true,
      reasonCode: "missing_features",
      reasonDetail: "Need bulk CSV import",
    })
  })
})
