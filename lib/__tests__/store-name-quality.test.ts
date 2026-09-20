import { describe, expect, it } from "vitest"

import { assessStoreName, isPresentableStoreName } from "@/lib/store-name-quality"

describe("store name quality", () => {
  it.each([
    ["https://www.tiktok.com/@singhhaam Store", "link"],
    ["www.monshop.fr", "link"],
    ["@singhhaam", "handle"],
    ["jean@gmail.com", "email"],
    ["A", "too_short"],
    ["12345", "digits_only"],
    ["My Store", "generic"],
    ["", "empty"],
  ])("rejects %s", (name, problem) => {
    expect(assessStoreName(name)).toEqual({ ok: false, problem })
  })

  it.each(["Marc Boutique", "Nova Store", "Maison Lumière", "Atelier N°5", "Riky Store"])("accepts %s", (name) => {
    expect(isPresentableStoreName(name)).toBe(true)
  })
})
