import { describe, expect, it } from "vitest"

import { isValidShipsToCode, readShipsToFromDocumentCookie, writeShipsToDocumentCookie } from "@/lib/ships-to-preference"

describe("isValidShipsToCode", () => {
  it("accepts a plain two-letter uppercase code", () => {
    expect(isValidShipsToCode("FR")).toBe(true)
    expect(isValidShipsToCode("US")).toBe(true)
  })

  it("rejects anything else", () => {
    expect(isValidShipsToCode("fr")).toBe(false)
    expect(isValidShipsToCode("FRA")).toBe(false)
    expect(isValidShipsToCode("F")).toBe(false)
    expect(isValidShipsToCode("")).toBe(false)
    expect(isValidShipsToCode("12")).toBe(false)
  })
})

// This project's vitest environment is "node" (no DOM) — same convention as
// lib/i18n-read-locale-cookie.ts's own test: verify the SSR-safe no-document guard here,
// the real read/write round trip is covered by live browser verification.
describe("ships-to cookie — server/no-document guards", () => {
  it("read returns null without a document instead of throwing", () => {
    expect(readShipsToFromDocumentCookie()).toBeNull()
  })

  it("write is a silent no-op without a document instead of throwing", () => {
    expect(() => writeShipsToDocumentCookie("FR")).not.toThrow()
  })
})
