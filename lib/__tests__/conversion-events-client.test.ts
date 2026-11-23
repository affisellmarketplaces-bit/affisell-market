// @vitest-environment jsdom
/**
 * Browser client of the conversion events: two locks (public switch + analytics consent), nothing queued and no
 * identifier created when either is closed, everything forgotten when consent is withdrawn.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const consent = vi.hoisted(() => ({ granted: false }))
vi.mock("@/lib/legal/cookie-consent-runtime", () => ({ hasAnalyticsConsent: () => consent.granted }))

import { emitConversionEvent, flushConversionEvents, forgetConversionEvents } from "@/lib/events/client"

describe("conversion events — browser client", () => {
  const beacon = vi.fn(() => true)
  beforeEach(() => {
    forgetConversionEvents()
    beacon.mockClear()
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
    delete process.env.NEXT_PUBLIC_CONVERSION_EVENTS_MODE
    consent.granted = false
  })
  afterEach(() => forgetConversionEvents())

  it("switch off: nothing queued, no identifier created, even with consent", () => {
    consent.granted = true
    expect(emitConversionEvent("product_view", { listingId: "listing-1" })).toBe(false)
    expect(sessionStorage.getItem("affisell:ev-session")).toBeNull()
    flushConversionEvents()
    expect(beacon).not.toHaveBeenCalled()
  })
  it("switch on but no consent: nothing queued, no identifier", () => {
    process.env.NEXT_PUBLIC_CONVERSION_EVENTS_MODE = "on"
    expect(emitConversionEvent("product_view", { listingId: "listing-1" })).toBe(false)
    expect(sessionStorage.getItem("affisell:ev-session")).toBeNull()
  })
  it("both locks open: one batch with a tab session id, no account or visitor id", async () => {
    process.env.NEXT_PUBLIC_CONVERSION_EVENTS_MODE = "on"
    consent.granted = true
    expect(emitConversionEvent("product_view", { listingId: "listing-1" })).toBe(true)
    flushConversionEvents()
    expect(beacon).toHaveBeenCalledTimes(1)
    const blob = (beacon.mock.calls[0] as unknown as [string, Blob])[1]
    const body = JSON.parse(await blob.text()) as { events: Array<Record<string, unknown>> }
    expect(body.events[0]).toMatchObject({ name: "product_view", listingId: "listing-1", sessionId: sessionStorage.getItem("affisell:ev-session") })
    expect(body.events[0]).not.toHaveProperty("userId")
    expect(body.events[0]).not.toHaveProperty("anonymousId")
  })
  it("consent withdrawn: queue emptied, tab id deleted, nothing sent", () => {
    process.env.NEXT_PUBLIC_CONVERSION_EVENTS_MODE = "on"
    consent.granted = true
    emitConversionEvent("add_to_cart", { listingId: "listing-1" })
    window.dispatchEvent(new CustomEvent("affisell:cookie-consent", { detail: { analytics: false } }))
    expect(sessionStorage.getItem("affisell:ev-session")).toBeNull()
    flushConversionEvents()
    expect(beacon).not.toHaveBeenCalled()
  })
  it("consent lost between emit and flush: nothing sent", () => {
    process.env.NEXT_PUBLIC_CONVERSION_EVENTS_MODE = "on"
    consent.granted = true
    emitConversionEvent("product_view", { listingId: "listing-1" })
    consent.granted = false
    flushConversionEvents()
    expect(beacon).not.toHaveBeenCalled()
  })
})
