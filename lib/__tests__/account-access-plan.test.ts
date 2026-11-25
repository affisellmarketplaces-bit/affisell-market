import { describe, expect, it } from "vitest"

import {
  adminPasswordProblem,
  lockTag,
  planCreateAdmin,
  planLock,
  planUnlock,
} from "../../scripts/lib/account-access-plan.mjs"
import { isPasswordLocked } from "@/lib/auth-account-lock"

const row = (email: string, role = "CUSTOMER", extra: Partial<{ hasPassword: boolean; locked: boolean }> = {}) => ({
  email,
  role,
  hasPassword: true,
  locked: false,
  ...extra,
})

describe("account-access plan (fails closed)", () => {
  it("lock tag is recognised by the sign-in / session check", () => {
    const tag = lockTag(new Date("2026-11-25T10:00:00Z"))
    expect(tag).toBe("locked-2026-11-25:")
    expect(isPasswordLocked(`${tag}$2a$12$x`)).toBe(true)
  })

  it("admin password: length, whitespace, published values", () => {
    expect(adminPasswordProblem("")).toBe("password_missing")
    expect(adminPasswordProblem("short-one")).toBe("password_too_short")
    expect(adminPasswordProblem(" padded-password-123456 ")).toBe("password_whitespace")
    expect(adminPasswordProblem("a-long-and-unpublished-passphrase-42")).toBeNull()
  })

  it("create-admin refuses an invalid or existing e-mail", () => {
    expect(planCreateAdmin({ email: "nope", existing: null })).toEqual({ ok: false, reason: "email_invalid" })
    expect(planCreateAdmin({ email: "ops@affisell.com", existing: { email: "ops@affisell.com" } }).ok).toBe(false)
    expect(planCreateAdmin({ email: "ops@affisell.com", existing: null }).ok).toBe(true)
  })

  it("lock: exact count, every account present, has a password, not already locked", () => {
    const rows = [row("a@x.com"), row("b@x.com")]
    expect(planLock({ emails: ["a@x.com", "b@x.com"], expect: 3, rows, unlockedAdminsTotal: 1 }).ok).toBe(false)
    expect(planLock({ emails: ["a@x.com", "c@x.com"], expect: 2, rows, unlockedAdminsTotal: 1 })).toMatchObject({
      reason: "account_missing",
      detail: ["c@x.com"],
    })
    expect(
      planLock({ emails: ["a@x.com"], expect: 1, rows: [row("a@x.com", "CUSTOMER", { hasPassword: false })], unlockedAdminsTotal: 1 })
    ).toMatchObject({ reason: "no_password_to_lock" })
    expect(
      planLock({ emails: ["a@x.com"], expect: 1, rows: [row("a@x.com", "CUSTOMER", { locked: true })], unlockedAdminsTotal: 1 })
    ).toMatchObject({ reason: "already_locked" })
    expect(planLock({ emails: [" A@x.com ", "b@x.com"], expect: 2, rows, unlockedAdminsTotal: 1 })).toEqual({
      ok: true,
      targets: ["a@x.com", "b@x.com"],
    })
  })

  it("never locks the last unlocked admin; allows it once another admin exists", () => {
    const rows = [row("admin@affisell.io", "ADMIN")]
    expect(planLock({ emails: ["admin@affisell.io"], expect: 1, rows, unlockedAdminsTotal: 1 })).toMatchObject({
      reason: "would_lock_out_last_admin",
    })
    expect(planLock({ emails: ["admin@affisell.io"], expect: 1, rows, unlockedAdminsTotal: 2 }).ok).toBe(true)
  })

  it("unlock only touches locked accounts", () => {
    expect(planUnlock({ emails: ["a@x.com"], expect: 1, rows: [row("a@x.com")] })).toMatchObject({ reason: "not_locked" })
    expect(planUnlock({ emails: ["a@x.com"], expect: 1, rows: [row("a@x.com", "CUSTOMER", { locked: true })] }).ok).toBe(true)
  })
})
