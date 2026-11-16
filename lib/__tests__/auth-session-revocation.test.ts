import { describe, expect, it } from "vitest"

import {
  credentialFingerprint,
  decideJwtRefresh,
  evaluateSessionValidity,
  NO_PASSWORD_FINGERPRINT,
  SESSION_RECHECK_MS,
} from "@/lib/auth-session-revocation"

const SECRET = "fingerprint-test-secret"
const HASH_A = "$2b$10$EBYjLkjLBWt/sg2nzV4yguqjXbuPxBuJg7saNbXRcxAl/3yO/VnNm"
const HASH_B = "$2b$04$MXvJSILVhf4zUw.l14j9Fu0KOImPYDtFQZb/zjZZE3FGVTOg4gzl2"

describe("credentialFingerprint", () => {
  it("is stable for one hash and secret, and changes with the hash", () => {
    expect(credentialFingerprint(HASH_A, SECRET)).toBe(credentialFingerprint(HASH_A, SECRET))
    expect(credentialFingerprint(HASH_A, SECRET)).not.toBe(credentialFingerprint(HASH_B, SECRET))
  })

  it("depends on the secret (a cookie does not reveal anything usable about the hash)", () => {
    expect(credentialFingerprint(HASH_A, SECRET)).not.toBe(credentialFingerprint(HASH_A, "another-secret"))
    expect(credentialFingerprint(HASH_A, SECRET)).not.toContain(HASH_A.slice(7, 20))
    expect(credentialFingerprint(HASH_A, SECRET)).toHaveLength(22)
  })

  it("has a fixed value for an account without a password", () => {
    expect(credentialFingerprint(null, SECRET)).toBe(NO_PASSWORD_FINGERPRINT)
    expect(credentialFingerprint("", SECRET)).toBe(NO_PASSWORD_FINGERPRINT)
  })
})

describe("decideJwtRefresh", () => {
  const now = 1_800_000_000_000

  it("signs in, updates, and re-checks a token without a role", () => {
    expect(decideJwtRefresh({ signingIn: true, trigger: undefined, tokenHasRole: true, checkedAt: now, now })).toBe(
      "sign_in"
    )
    expect(decideJwtRefresh({ signingIn: false, trigger: "update", tokenHasRole: true, checkedAt: now, now })).toBe(
      "update"
    )
    expect(decideJwtRefresh({ signingIn: false, trigger: undefined, tokenHasRole: false, checkedAt: now, now })).toBe(
      "recheck"
    )
  })

  it("trusts the token inside the interval and re-checks after it", () => {
    const base = { signingIn: false, trigger: undefined, tokenHasRole: true, now }
    expect(decideJwtRefresh({ ...base, checkedAt: now - SESSION_RECHECK_MS + 1 })).toBe("keep")
    expect(decideJwtRefresh({ ...base, checkedAt: now - SESSION_RECHECK_MS })).toBe("recheck")
  })

  it("re-checks a token that was never checked (minted before this module) or carries a bad / future stamp", () => {
    const base = { signingIn: false, trigger: undefined, tokenHasRole: true, now }
    expect(decideJwtRefresh({ ...base, checkedAt: undefined })).toBe("recheck")
    expect(decideJwtRefresh({ ...base, checkedAt: "1800000000000" })).toBe("recheck")
    expect(decideJwtRefresh({ ...base, checkedAt: Number.NaN })).toBe("recheck")
    expect(decideJwtRefresh({ ...base, checkedAt: now + 60_000 })).toBe("recheck")
  })
})

describe("evaluateSessionValidity", () => {
  const current = credentialFingerprint(HASH_A, SECRET)

  it("ends the session of a deleted account", () => {
    expect(evaluateSessionValidity({ userExists: false, tokenFingerprint: current, currentFingerprint: current })).toEqual({
      valid: false,
      reason: "user_missing",
    })
  })

  it("ends the session when the password changed since sign-in", () => {
    const old = credentialFingerprint(HASH_B, SECRET)
    expect(evaluateSessionValidity({ userExists: true, tokenFingerprint: old, currentFingerprint: current })).toEqual({
      valid: false,
      reason: "credentials_changed",
    })
    // a password set on an account that had none (OAuth → password) ends the older sessions too
    expect(
      evaluateSessionValidity({ userExists: true, tokenFingerprint: NO_PASSWORD_FINGERPRINT, currentFingerprint: current })
    ).toEqual({ valid: false, reason: "credentials_changed" })
  })

  it("keeps a matching session, and lets a token without fingerprint adopt the current one", () => {
    expect(evaluateSessionValidity({ userExists: true, tokenFingerprint: current, currentFingerprint: current })).toEqual({
      valid: true,
      fingerprint: current,
    })
    expect(evaluateSessionValidity({ userExists: true, tokenFingerprint: undefined, currentFingerprint: current })).toEqual(
      { valid: true, fingerprint: current }
    )
  })
})
