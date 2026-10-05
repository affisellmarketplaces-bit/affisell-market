import { describe, expect, it } from "vitest"

import { scrubCredentialParams } from "@/lib/scrub-credential-query"

const scrub = (u: string) => scrubCredentialParams(new URL(u))?.toString() ?? null

describe("scrubCredentialParams", () => {
  it("removes a password but keeps the rest of the query", () => {
    expect(scrub("https://x.test/login/supplier?email=a%40b.co&password=secret")).toBe(
      "https://x.test/login/supplier?email=a%40b.co"
    )
  })

  it("drops the whole query string when only secrets were in it", () => {
    expect(scrub("https://x.test/login?password=secret")).toBe("https://x.test/login")
  })

  it("is case-insensitive and handles repeated and confirm/new variants", () => {
    expect(scrub("https://x.test/p?Password=a&password=b&confirmPassword=c&newPassword=d&keep=1")).toBe(
      "https://x.test/p?keep=1"
    )
  })

  it("returns null when there is nothing to remove, so the proxy does not redirect", () => {
    expect(scrub("https://x.test/login/supplier?email=a%40b.co&callbackUrl=%2Fdashboard")).toBeNull()
    expect(scrub("https://x.test/login")).toBeNull()
  })

  it("never touches reset / magic-link tokens", () => {
    expect(scrub("https://x.test/reset-password?token=abc123")).toBeNull()
    expect(scrub("https://x.test/auth/verify?code=123456&email=a%40b.co")).toBeNull()
  })

  it("does not remove params that merely contain the word", () => {
    expect(scrub("https://x.test/p?passwordless=1&bypass=2")).toBeNull()
  })
})
