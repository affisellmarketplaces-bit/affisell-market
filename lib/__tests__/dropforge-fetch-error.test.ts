import { describe, expect, it } from "vitest"

import { dropforgeHttpErrorMessage } from "@/lib/dropforge-fetch-error"

describe("dropforgeHttpErrorMessage", () => {
  it("returns API error string when present", () => {
    const res = new Response("", { status: 400 })
    expect(dropforgeHttpErrorMessage(res, { error: "preview_required" }, "fr")).toBe(
      "preview_required"
    )
  })

  it("maps HTML 502 to friendly French copy", () => {
    const res = new Response("<!DOCTYPE html>", {
      status: 504,
      headers: { "content-type": "text/html" },
    })
    expect(dropforgeHttpErrorMessage(res, {}, "fr")).toContain("trop de temps")
  })

  it("maps empty 403 to shield message", () => {
    const res = new Response("", { status: 403 })
    expect(dropforgeHttpErrorMessage(res, {}, "fr")).toContain("bloquée")
  })
})
