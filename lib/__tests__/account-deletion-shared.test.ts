import { describe, expect, it } from "vitest"

import {
  isAccountDeletionConfirmed,
  normalizeAccountDeletionEmail,
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
})
