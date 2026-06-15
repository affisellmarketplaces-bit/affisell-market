import { describe, expect, it } from "vitest"

import {
  joinLaunchWaitlistPayload,
  normalizeLaunchWaitlistEmail,
  validateJoinLaunchWaitlist,
} from "@/lib/checkout-launch-waitlist"

describe("checkout-launch-waitlist", () => {
  it("normalizes emails", () => {
    expect(normalizeLaunchWaitlistEmail("  User@Example.COM ")).toBe("user@example.com")
    expect(normalizeLaunchWaitlistEmail("not-an-email")).toBeNull()
  })

  it("accepts ROW countries", () => {
    expect(validateJoinLaunchWaitlist({ email: "a@b.com", countryIso2: "JP", marketRegion: "eu" })).toBeNull()
  })

  it("builds upsert payload", () => {
    const payload = joinLaunchWaitlistPayload({
      email: "buyer@example.com",
      countryIso2: "jp",
      marketRegion: "eu",
      locale: "fr",
    })
    expect(payload).toEqual({
      email: "buyer@example.com",
      countryIso2: "JP",
      marketRegion: "eu",
      locale: "fr",
    })
  })
})
