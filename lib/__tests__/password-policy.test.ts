import { describe, expect, it } from "vitest"

import { checkPasswordPolicy, passwordPolicyMessageFr, PASSWORD_MAX_BYTES } from "@/lib/password-policy"

describe("checkPasswordPolicy", () => {
  it("accepts an ordinary strong password", () => {
    expect(checkPasswordPolicy("Tr0ub4dor-horse-77", { email: "jo@example.com" })).toEqual({ ok: true })
  })

  it("refuses a missing or non-string password", () => {
    expect(checkPasswordPolicy(undefined)).toEqual({ ok: false, error: "password_missing" })
    expect(checkPasswordPolicy("")).toEqual({ ok: false, error: "password_missing" })
    expect(checkPasswordPolicy(12345678)).toEqual({ ok: false, error: "password_missing" })
  })

  it("counts characters, not UTF-16 units, for the minimum", () => {
    expect(checkPasswordPolicy("Ab3$xyz")).toEqual({ ok: false, error: "password_too_short" })
    // 8 emoji = 8 characters (16 UTF-16 units): long enough
    expect(checkPasswordPolicy("😀🙂😺🐱🦊🐻🐼🐨")).toEqual({ ok: true })
    // 4 emoji = 8 UTF-16 units but only 4 characters: too short
    expect(checkPasswordPolicy("😀🙂😺🐱")).toEqual({ ok: false, error: "password_too_short" })
  })

  it("refuses what bcrypt would silently truncate (more than 72 bytes)", () => {
    expect(checkPasswordPolicy("a1".repeat(36))).toEqual({ ok: true })
    expect(Buffer.byteLength("a1".repeat(36))).toBe(PASSWORD_MAX_BYTES)
    expect(checkPasswordPolicy(`${"a1".repeat(36)}x`)).toEqual({ ok: false, error: "password_too_long" })
    // 37 two-byte characters = 74 bytes
    expect(checkPasswordPolicy("é".repeat(37))).toEqual({ ok: false, error: "password_too_long" })
  })

  it("refuses the most common passwords and a single repeated character, whatever the case", () => {
    for (const p of ["password123", "PASSWORD123", "12345678", "Azertyuiop", "motdepasse", "aaaaaaaa", "ZZZZZZZZZZ"]) {
      expect(checkPasswordPolicy(p)).toEqual({ ok: false, error: "password_too_common" })
    }
  })

  it("refuses the account's own e-mail or its local part", () => {
    expect(checkPasswordPolicy("Jean.Dupont@example.com", { email: "jean.dupont@example.com" })).toEqual({
      ok: false,
      error: "password_matches_email",
    })
    expect(checkPasswordPolicy("jean.dupont", { email: "Jean.Dupont@example.com" })).toEqual({
      ok: false,
      error: "password_matches_email",
    })
  })

  it("has a French sentence for every code", () => {
    for (const code of [
      "password_missing",
      "password_too_short",
      "password_too_long",
      "password_too_common",
      "password_matches_email",
    ] as const) {
      expect(passwordPolicyMessageFr(code).length).toBeGreaterThan(10)
    }
  })
})
