import { describe, expect, it } from "vitest"

import {
  BEHAVIORAL_EVENT_NAMES,
  CLIENT_EMITTABLE_EVENT_NAMES,
  EVENT_CLASSES,
  EVENT_REGISTRY,
  TRANSACTIONAL_EVENT_NAMES,
  eventClassOf,
  isEventName,
  type EventName,
} from "@/lib/events/names"
import { EVENT_PROPERTY_KEYS, sanitizeProperties } from "@/lib/events/properties"

const ALL = Object.keys(EVENT_REGISTRY) as EventName[]

describe("event registry — the two classes", () => {
  it("every event belongs to exactly one class, and the two lists partition the registry", () => {
    for (const name of ALL) expect(EVENT_CLASSES).toContain(EVENT_REGISTRY[name].class)
    expect([...BEHAVIORAL_EVENT_NAMES, ...TRANSACTIONAL_EVENT_NAMES].sort()).toEqual([...ALL].sort())
    expect(BEHAVIORAL_EVENT_NAMES.filter((n) => TRANSACTIONAL_EVENT_NAMES.includes(n))).toEqual([])
  })

  it("behavioral = analytics (consent-bound); transactional = business journal", () => {
    for (const n of ["product_impression", "product_click", "product_view", "search", "attribution_touch", "add_to_cart", "remove_from_cart"] as const) {
      expect(eventClassOf(n), n).toBe("behavioral")
    }
    for (const n of ["purchase", "refund", "return_requested", "return_resolved", "delivery", "review_created", "creator_product_added", "creator_product_removed"] as const) {
      expect(eventClassOf(n), n).toBe("transactional")
    }
  })

  it("a browser can never be the source of a business fact: no transactional event is client-emittable", () => {
    for (const n of TRANSACTIONAL_EVENT_NAMES) expect(EVENT_REGISTRY[n].clientEmittable, n).toBe(false)
    for (const n of CLIENT_EMITTABLE_EVENT_NAMES) expect(EVENT_REGISTRY[n].class, n).toBe("behavioral")
  })

  it("the names written before the spine keep working, as behavioral events", () => {
    for (const n of ["view", "hover", "add_to_cart", "checkout_initiated"] as const) {
      expect(isEventName(n), n).toBe(true)
      expect(eventClassOf(n), n).toBe("behavioral")
      expect(EVENT_REGISTRY[n].legacy, n).toBe(true)
    }
  })

  it("rejects anything that is not a registered name (including prototype keys)", () => {
    for (const bad of ["", "Purchase", "toString", "__proto__", "constructor", "hasOwnProperty", 3, null, undefined, {}]) {
      expect(isEventName(bad), String(bad)).toBe(false)
      expect(eventClassOf(bad)).toBeNull()
    }
  })
})

describe("event properties — an explicit list per event", () => {
  it("every event has a property list, and no list refers to an unknown event", () => {
    expect(Object.keys(EVENT_PROPERTY_KEYS).sort()).toEqual([...ALL].sort())
  })

  it("keeps only whitelisted keys, with sanitised values, and drops the rest", () => {
    const out = sanitizeProperties("search", {
      query: "  Lampe  de Bureau  ",
      result_count: "12",
      surface: "marketplace",
      email: "visitor@example.com",
      utm_source: "newsletter",
      __proto__: { polluted: true },
    })
    expect(out).toEqual({ query: "lampe de bureau", result_count: 12, surface: "marketplace" })
  })

  it("returns null (not an empty object) when nothing valid is left", () => {
    expect(sanitizeProperties("purchase", { nope: 1 })).toBeNull()
    expect(sanitizeProperties("view", { anything: "x" })).toBeNull()
    expect(sanitizeProperties("search", null)).toBeNull()
    expect(sanitizeProperties("search", ["query"])).toBeNull()
    expect(sanitizeProperties("search", "query")).toBeNull()
  })

  it("never accepts a click identifier — only the platform it points to", () => {
    const out = sanitizeProperties("attribution_touch", { click_platform: "meta", fbclid: "IwAR0abc", gclid: "x", click_platform_id: "y" })
    expect(out).toEqual({ click_platform: "meta" })
  })

  it("an e-mail hidden in a UTM value drops the value, not the event", () => {
    const out = sanitizeProperties("attribution_touch", { utm_source: "newsletter", utm_content: "jane.doe@example.com", referrer_host: "l.instagram.com" })
    expect(out).toEqual({ utm_source: "newsletter", referrer_host: "l.instagram.com" })
  })

  it("bounds numbers and enums", () => {
    expect(sanitizeProperties("product_impression", { position: -1, surface: "grid" })).toEqual({ surface: "grid" })
    expect(sanitizeProperties("product_impression", { position: 3, device: "fridge" })).toEqual({ position: 3 })
    expect(sanitizeProperties("add_to_cart", { quantity: 0, mode: "guest" })).toEqual({ mode: "guest" })
    expect(sanitizeProperties("add_to_cart", { quantity: 100 })).toBeNull()
    expect(sanitizeProperties("review_created", { rating: 6 })).toBeNull()
    expect(sanitizeProperties("review_created", { rating: 5 })).toEqual({ rating: 5 })
  })
})
