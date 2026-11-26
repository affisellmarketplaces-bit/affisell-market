import { describe, expect, it } from "vitest"

import { effectiveRole, parseAdminAllowlist } from "@/lib/admin-allowlist"

describe("admin allowlist", () => {
  it("unset or empty: the database role decides", () => {
    expect(parseAdminAllowlist(undefined)).toBeNull()
    expect(parseAdminAllowlist(" , ")).toBeNull()
    expect(effectiveRole("ADMIN", "a@x.com", {})).toBe("ADMIN")
  })
  it("set: only listed e-mails (trimmed, case-insensitive) keep ADMIN; others become CUSTOMER", () => {
    const env = { ADMIN_EMAIL_ALLOWLIST: " Ops@Affisell.com ,b@x.com" }
    expect(effectiveRole("ADMIN", "ops@affisell.com", env)).toBe("ADMIN")
    expect(effectiveRole("ADMIN", "admin@affisell.io", env)).toBe("CUSTOMER")
    expect(effectiveRole("ADMIN", undefined, env)).toBe("CUSTOMER")
  })
  it("never grants or changes a non-admin role", () => {
    const env = { ADMIN_EMAIL_ALLOWLIST: "s@x.com" }
    for (const role of ["SUPPLIER", "AFFILIATE", "CUSTOMER", "AGENT"]) expect(effectiveRole(role, "s@x.com", env)).toBe(role)
  })
})
