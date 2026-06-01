import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isProductionEmailDelivery,
  isResendSandboxFrom,
  resolveResendRecipient,
} from "@/lib/emails/resolve-resend-recipient"

describe("resolveResendRecipient", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("detects Resend sandbox from address", () => {
    expect(isResendSandboxFrom("Affisell <onboarding@resend.dev>")).toBe(true)
    expect(isResendSandboxFrom("Affisell <noreply@affisell.com>")).toBe(false)
  })

  it("sends to intended recipient in production even with sandbox from", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    const result = resolveResendRecipient({
      intendedTo: "client@example.com",
      fromEmail: "Affisell <onboarding@resend.dev>",
      testEmailTo: "founder@affisell.com",
    })
    expect(result.to).toBe("client@example.com")
    expect(result.devRedirect).toBe(false)
  })

  it("redirects to TEST_EMAIL_TO in local dev with sandbox from", () => {
    vi.stubEnv("VERCEL_ENV", "development")
    vi.stubEnv("NODE_ENV", "development")
    const result = resolveResendRecipient({
      intendedTo: "client@example.com",
      fromEmail: "Affisell <onboarding@resend.dev>",
      testEmailTo: "founder@affisell.com",
    })
    expect(result.to).toBe("founder@affisell.com")
    expect(result.devRedirect).toBe(true)
  })

  it("sends to intended with verified domain in dev", () => {
    vi.stubEnv("NODE_ENV", "development")
    const result = resolveResendRecipient({
      intendedTo: "client@example.com",
      fromEmail: "Affisell <noreply@affisell.com>",
      testEmailTo: "founder@affisell.com",
    })
    expect(result.to).toBe("client@example.com")
    expect(result.devRedirect).toBe(false)
  })
})

describe("isProductionEmailDelivery", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is true on Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isProductionEmailDelivery()).toBe(true)
  })
})
