import { describe, expect, it } from "vitest"

import { EVENT_PROPERTY_KEYS, sanitizeProperties } from "@/lib/events/properties"
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MAX_WORDS,
  queryDropReason,
  sanitizeSearchQuery,
} from "@/lib/events/sanitize"

/**
 * The spine keeps the PRODUCT VOCABULARY of a search, and nothing that identifies a person, an order, a payment
 * instrument or a place. When a query looks like one of those the whole query is dropped (never half-masked).
 * This is technical data minimisation — not a personal-data detector, and not a legal statement.
 */

describe("a search query that is product vocabulary is kept (normalised)", () => {
  const kept: Array<[string, string]> = [
    ["Lampe de Bureau", "lampe de bureau"],
    ["  iPhone   15 Pro 256 ", "iphone 15 pro 256"],
    ["canapé 2 places", "canapé 2 places"],
    ["road bike 21 speed", "road bike 21 speed"],
    ["WH-1000XM5 sony", "wh-1000xm5 sony"],
    ["samsung-galaxy-s24-ultra-256go-noir", "samsung-galaxy-s24-ultra-256go-noir"],
    ["chaussures de running homme taille 42", "chaussures de running homme taille 42"],
    ["powerbank 20000mah", "powerbank 20000mah"],
    ["红色连衣裙", "红色连衣裙"],
    ["ＬＡＭＰＥ", "lampe"], // full-width characters are normalised
    ["commande 1234", "commande 1234"], // 4 digits is a model/size number, not an order number
  ]
  it.each(kept)("%s", (input, expected) => {
    expect(sanitizeSearchQuery(input)).toBe(expected)
  })

  it("a barcode is a legitimate search: a VALID GTIN is kept", () => {
    expect(sanitizeSearchQuery("4006381333931")).toBe("4006381333931") // EAN-13
    expect(sanitizeSearchQuery("73513537")).toBe("73513537") // EAN-8
    expect(sanitizeSearchQuery("ean 4006381333931")).toBe("ean 4006381333931")
  })

  it("control characters become separators or disappear", () => {
    expect(sanitizeSearchQuery("  Lampe\u0000   DE\tBureau \n")).toBe("lampe de bureau")
  })
})

describe("the identifying cases are dropped as a whole — not stored half-masked", () => {
  it("e-mail", () => {
    expect(queryDropReason("marie.dupont@example.com")).toBe("email")
    expect(sanitizeSearchQuery("chaussures marie@example.com")).toBeNull()
    expect(sanitizeSearchQuery("JANE.DOE+shop@Example.co.uk")).toBeNull()
  })

  it("phone number", () => {
    for (const q of ["06 12 34 56 78", "0612345678", "+33 6 12 34 56 78", "appelez 06.12.34.56.78", "(212) 555-0147 call"]) {
      expect(sanitizeSearchQuery(q), q).toBeNull()
    }
    expect(queryDropReason("06 12 34 56 78")).toBe("digit_run")
  })

  it("card number", () => {
    for (const q of ["4111 1111 1111 1111", "4111111111111111", "4111-1111-1111-1111", "5500 0000 0000 0004 exp 12"]) {
      expect(sanitizeSearchQuery(q), q).toBeNull()
    }
  })

  it("IBAN (compact and spaced)", () => {
    expect(sanitizeSearchQuery("FR7630006000011234567890189")).toBeNull()
    expect(sanitizeSearchQuery("FR76 3000 6000 0112 3456 7890 189")).toBeNull()
    expect(sanitizeSearchQuery("DE89 3704 0044 0532 0130 00")).toBeNull()
    expect(sanitizeSearchQuery("gb29 nwbk 6016 1331 9268 19")).toBeNull()
  })

  it("opaque token / key / session id", () => {
    expect(queryDropReason("sk1a2b3c4d5e6f7g8h9i0j1k2l3m4")).toBe("identifier_token")
    expect(sanitizeSearchQuery("key sk1A2b3C4d5E6f7G8h9I0j1K2l3M4")).toBeNull()
    expect(sanitizeSearchQuery("cs_test_a1B2c3D4e5F6g7H8i9")).toBeNull() // a Stripe session id
    expect(sanitizeSearchQuery("cmpmibth80001la04ysgbjef6")).toBeNull() // an Affisell id
  })

  it("order number / reference / tracking number", () => {
    expect(queryDropReason("commande 12345")).toBe("long_number")
    expect(sanitizeSearchQuery("cmd-2026-001234")).toBeNull()
    expect(sanitizeSearchQuery("ORD-2026-AB12CD34EF56")).toBeNull()
    expect(sanitizeSearchQuery("1Z999AA10123456784")).toBeNull() // a parcel tracking number
    expect(sanitizeSearchQuery("order 98765432")).toBeNull()
  })

  it("postal address", () => {
    expect(queryDropReason("12 rue des lilas")).toBe("street_address")
    expect(queryDropReason("12 main street")).toBe("street_address")
    expect(queryDropReason("rue des lilas 12")).toBe("street_address")
    expect(queryDropReason("hauptstraße 12")).toBe("street_address")
    expect(queryDropReason("5 avenue")).toBe("street_address")
    expect(queryDropReason("calle mayor 5")).toBe("street_address")
    expect(sanitizeSearchQuery("12 rue des lilas 75011 paris")).toBeNull() // street + postal code
    expect(sanitizeSearchQuery("75011")).toBeNull() // a postal code alone
  })

  it("URL", () => {
    expect(queryDropReason("https://example.com/?t=abc")).toBe("url")
    expect(sanitizeSearchQuery("www.exemple.fr/produit")).toBeNull()
  })

  it("a dropped query leaves nothing behind — not even a placeholder", () => {
    for (const q of ["jane@example.com", "06 12 34 56 78", "FR7630006000011234567890189", "12 rue des lilas"]) {
      expect(sanitizeSearchQuery(q)).toBeNull()
    }
  })
})

describe("KNOWN LIMIT — a person's name is not filtered, on purpose", () => {
  // A name cannot be told from a brand, and brands ARE the search intelligence. These are kept; the word and length
  // limits, the consent requirement and (later) retention are what bound the residual, not a name detector.
  it.each(["jean dupont", "louis vuitton", "calvin klein", "marie claire magazine"])("%s is kept", (q) => {
    expect(sanitizeSearchQuery(q)).toBe(q)
  })

  it("but a name together with an address, a number or an e-mail is dropped", () => {
    expect(sanitizeSearchQuery("jean dupont 12 rue des lilas")).toBeNull()
    expect(sanitizeSearchQuery("jean dupont 06 12 34 56 78")).toBeNull()
    expect(sanitizeSearchQuery("jean dupont jean@example.com")).toBeNull()
  })
})

describe("strict limits", () => {
  it(`more than ${SEARCH_QUERY_MAX_WORDS} words is not a product search — dropped, not truncated`, () => {
    const eight = Array.from({ length: SEARCH_QUERY_MAX_WORDS }, (_, i) => `mot${i}`).join(" ")
    expect(sanitizeSearchQuery(eight)).toBe(eight)
    expect(queryDropReason(`${eight} extra`)).toBe("too_many_words")
    expect(sanitizeSearchQuery(`${eight} extra`)).toBeNull()
  })

  it(`more than ${SEARCH_QUERY_MAX_LENGTH} characters is dropped, not truncated`, () => {
    expect(queryDropReason("a".repeat(SEARCH_QUERY_MAX_LENGTH + 1))).toBe("too_long")
    expect(sanitizeSearchQuery("a".repeat(SEARCH_QUERY_MAX_LENGTH + 1))).toBeNull()
    const exactly = `${"ab ".repeat(33)}a` // 100 characters, 34 words → too many words, not too long
    expect(exactly.length).toBe(100)
    expect(queryDropReason(exactly)).toBe("too_many_words")
  })

  it("a single word longer than 32 characters is not vocabulary", () => {
    expect(queryDropReason("x".repeat(33))).toBe("word_too_long")
  })

  it("empty and non-string input is nothing", () => {
    for (const bad of ["", "   ", "\u0000\u0001", null, undefined, 42, {}, []]) {
      expect(sanitizeSearchQuery(bad as never), String(bad)).toBeNull()
    }
  })
})

describe("what the spine keeps in `properties`", () => {
  it("a dropped query does not cost the rest of the search event", () => {
    const out = sanitizeProperties("search", { query: "jane@example.com", result_count: 0, search_id: "abcdef12", surface: "marketplace" })
    expect(out).toEqual({ result_count: 0, search_id: "abcdef12", surface: "marketplace" })
  })

  it("free text that does not serve the spine is no longer accepted at all", () => {
    expect(sanitizeProperties("add_to_cart", { variant: "Purple · M", quantity: 1 })).toEqual({ quantity: 1 })
    expect(sanitizeProperties("purchase", { variant: "Purple · M", amount_cents: 4990 })).toEqual({ amount_cents: 4990 })
    expect(sanitizeProperties("attribution_touch", { utm_term: "jean dupont chaussures", campaign_id: "abcdef12", utm_source: "newsletter" })).toEqual({
      utm_source: "newsletter",
    })
    expect(sanitizeProperties("product_view", { experiment_id: "exp-1", surface: "pdp" })).toEqual({ surface: "pdp" })
  })

  it("inventory: the exact set of keys the spine can store — adding one must be a conscious decision", () => {
    const all = [...new Set(Object.values(EVENT_PROPERTY_KEYS).flat())].sort()
    expect(all).toEqual(
      [
        "amount_cents", "click_platform", "content_id", "currency", "delivered_at_source", "device", "landing_kind", "mode",
        "outcome", "position", "quantity", "query", "rating", "reason_code", "referrer_host", "result_count", "scope_category",
        "search_id", "seq", "stripe_session_id", "surface", "utm_campaign", "utm_content", "utm_medium", "utm_source",
      ].sort()
    )
  })

  it("the only keys that can hold arbitrary-looking text are the search query and the acquisition parameters", () => {
    const freeTextCapable = new Set(["query", "utm_source", "utm_medium", "utm_campaign", "utm_content", "referrer_host"])
    const all = new Set(Object.values(EVENT_PROPERTY_KEYS).flat() as string[])
    const other = [...all].filter((k) => !freeTextCapable.has(k))
    // everything else is a number, a bounded enum, an identifier-shaped value or a slug
    expect(other.length).toBeGreaterThan(10)
    expect(all.has("variant")).toBe(false)
    expect(all.has("experiment_id")).toBe(false)
    expect(all.has("campaign_id")).toBe(false)
    expect(all.has("utm_term")).toBe(false)
  })
})
