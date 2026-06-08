import { describe, expect, it } from "vitest"

import { parseBookingPassTokenInput } from "@/lib/booking/parse-pass-token"

describe("parseBookingPassTokenInput", () => {
  const token = "a".repeat(48)

  it("accepts raw hex token", () => {
    expect(parseBookingPassTokenInput(token)).toBe(token)
  })

  it("extracts token from relative pass path", () => {
    expect(parseBookingPassTokenInput(`/booking/pass/${token}`)).toBe(token)
  })

  it("extracts token from full URL", () => {
    expect(parseBookingPassTokenInput(`https://affisell.com/booking/pass/${token}?x=1`)).toBe(token)
  })

  it("rejects empty or short input", () => {
    expect(parseBookingPassTokenInput("")).toBeNull()
    expect(parseBookingPassTokenInput("abc")).toBeNull()
  })
})
