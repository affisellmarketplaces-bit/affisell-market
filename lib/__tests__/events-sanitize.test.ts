import { describe, expect, it } from "vitest"

import {
  BEHAVIORAL_PAST_MS,
  FUTURE_TOLERANCE_MS,
  TRANSACTIONAL_PAST_MS,
  clampOccurredAt,
  sanitizeAnonymousId,
  sanitizeCountry,
  sanitizeEventId,
  sanitizeId,
  sanitizeInt,
  sanitizeLocale,
  sanitizeReferrerHost,
  sanitizeSessionId,
  sanitizeSlug,
  sanitizeUtm,
} from "@/lib/events/sanitize"

describe("identifiers keep the shape of identifiers", () => {
  it("entity ids", () => {
    expect(sanitizeId("cmpmibth80001la04ysgbjef6")).toBe("cmpmibth80001la04ysgbjef6")
    expect(sanitizeId("  re_3Abc123  ")).toBe("re_3Abc123")
    for (const bad of ["", "abc", "a b c d e f", "id;DROP TABLE", "x".repeat(65), "<script>alert(1)</script>", null, 12345678, undefined]) {
      expect(sanitizeId(bad as never), String(bad)).toBeNull()
    }
  })

  it("event ids may carry the separators of a deterministic business key", () => {
    expect(sanitizeEventId("purchase:cmpmibth80001la04ysgbjef6")).toBe("purchase:cmpmibth80001la04ysgbjef6")
    expect(sanitizeEventId("cs_test_a1B2c3:line:0")).toBe("cs_test_a1B2c3:line:0")
    expect(sanitizeEventId("0b9f7c3e-6c1a-4f5e-9d2b-1a2b3c4d5e6f")).toBeTruthy()
    for (const bad of ["short", "has space in it", "x".repeat(201), "semi;colon_here", "", null]) {
      expect(sanitizeEventId(bad as never), String(bad)).toBeNull()
    }
  })

  it("anonymous and session ids", () => {
    expect(sanitizeAnonymousId("0b9f7c3e-6c1a-4f5e-9d2b-1a2b3c4d5e6f")).toBeTruthy()
    expect(sanitizeAnonymousId("tooshort")).toBeNull()
    expect(sanitizeSessionId("abcd1234")).toBe("abcd1234")
    expect(sanitizeSessionId("abc")).toBeNull()
    expect(sanitizeSessionId("a".repeat(65))).toBeNull()
  })

  it("slugs, country and locale", () => {
    expect(sanitizeSlug(" Marketplace ")).toBe("marketplace")
    expect(sanitizeSlug("Not A Slug")).toBeNull()
    expect(sanitizeSlug("-leading")).toBeNull()
    expect(sanitizeCountry(" fr ")).toBe("FR")
    expect(sanitizeCountry("FRA")).toBeNull()
    expect(sanitizeCountry("F1")).toBeNull()
    expect(sanitizeLocale("fr")).toBe("fr")
    expect(sanitizeLocale("FR-fr")).toBe("fr-FR")
    expect(sanitizeLocale("fr-FR-x")).toBeNull()
    expect(sanitizeLocale("french")).toBeNull()
    expect(sanitizeLocale("zh-Hant-TW")).toBeNull()
  })

  it("bounded integers", () => {
    expect(sanitizeInt("12", 0, 100)).toBe(12)
    expect(sanitizeInt(12.5, 0, 100)).toBeNull()
    expect(sanitizeInt("1e3", 0, 10_000)).toBeNull()
    expect(sanitizeInt(101, 0, 100)).toBeNull()
    expect(sanitizeInt(-1, 0, 100)).toBeNull()
    expect(sanitizeInt(Number.NaN, 0, 100)).toBeNull()
    expect(sanitizeInt("", 0, 100)).toBeNull()
  })
})

// The search query (the only free text the spine keeps) has its own test file: events-search-query.test.ts

describe("acquisition parameters", () => {
  it("UTM values: lower-case, restricted alphabet, bounded", () => {
    expect(sanitizeUtm("  Spring_Sale-2026 ")).toBe("spring_sale-2026")
    expect(sanitizeUtm("a<b>c")).toBe("abc")
    expect(sanitizeUtm("x".repeat(200))!.length).toBe(64)
    expect(sanitizeUtm("")).toBeNull()
    expect(sanitizeUtm("<>")).toBeNull()
  })

  it("a UTM value that contains an e-mail address is dropped entirely", () => {
    expect(sanitizeUtm("jane.doe@example.com")).toBeNull()
    expect(sanitizeUtm("campaign-for-jane@x.io")).toBeNull()
  })

  it("referrer: only the host of an EXTERNAL site — never a path, query or fragment", () => {
    expect(sanitizeReferrerHost("https://www.instagram.com/p/AbC123/?igsh=secret#top", ["affisell.com"])).toBe("instagram.com")
    expect(sanitizeReferrerHost("https://l.facebook.com/l.php?u=https%3A%2F%2Faffisell.com", ["affisell.com"])).toBe("l.facebook.com")
  })

  it("referrer: own hosts, localhost, other schemes and garbage are not an acquisition", () => {
    const own = ["affisell.com", "shops.affisell.com"]
    expect(sanitizeReferrerHost("https://affisell.com/marketplace", own)).toBeNull()
    expect(sanitizeReferrerHost("https://www.affisell.com/", own)).toBeNull()
    expect(sanitizeReferrerHost("https://store.shops.affisell.com/x", own)).toBeNull()
    expect(sanitizeReferrerHost("http://localhost:3001/x", own)).toBeNull()
    expect(sanitizeReferrerHost("android-app://com.google.android.gm", own)).toBeNull()
    expect(sanitizeReferrerHost("javascript:alert(1)", own)).toBeNull()
    expect(sanitizeReferrerHost("not a url", own)).toBeNull()
    expect(sanitizeReferrerHost("", own)).toBeNull()
    expect(sanitizeReferrerHost(null, own)).toBeNull()
  })

  it("a look-alike of an own host is still external", () => {
    expect(sanitizeReferrerHost("https://notaffisell.com/", ["affisell.com"])).toBe("notaffisell.com")
    expect(sanitizeReferrerHost("https://affisell.com.evil.io/", ["affisell.com"])).toBe("affisell.com.evil.io")
  })
})

describe("occurredAt — ordering must not depend on a client's clock", () => {
  const now = new Date("2026-10-07T12:00:00Z")
  const ms = (offset: number) => now.getTime() + offset

  it("a missing or invalid time is the ingestion time", () => {
    for (const bad of [undefined, null, "garbage", Number.NaN, Infinity]) {
      expect(clampOccurredAt(bad as never, now, "behavioral").getTime()).toBe(now.getTime())
    }
  })

  it("behavioral: a plausible time is kept; the far future and the old past are not", () => {
    expect(clampOccurredAt(ms(-60_000), now, "behavioral").getTime()).toBe(ms(-60_000))
    expect(clampOccurredAt(ms(FUTURE_TOLERANCE_MS), now, "behavioral").getTime()).toBe(ms(FUTURE_TOLERANCE_MS))
    expect(clampOccurredAt(ms(FUTURE_TOLERANCE_MS + 1), now, "behavioral").getTime()).toBe(now.getTime())
    expect(clampOccurredAt(ms(-BEHAVIORAL_PAST_MS), now, "behavioral").getTime()).toBe(ms(-BEHAVIORAL_PAST_MS))
    expect(clampOccurredAt(ms(-BEHAVIORAL_PAST_MS - 1), now, "behavioral").getTime()).toBe(now.getTime())
  })

  it("transactional: the ledger's own date may be far in the past (backfill) but never in the future", () => {
    const sixMonthsAgo = ms(-180 * 24 * 3_600_000)
    expect(clampOccurredAt(sixMonthsAgo, now, "transactional").getTime()).toBe(sixMonthsAgo)
    expect(clampOccurredAt(ms(-TRANSACTIONAL_PAST_MS - 1), now, "transactional").getTime()).toBe(now.getTime())
    expect(clampOccurredAt(ms(FUTURE_TOLERANCE_MS + 1), now, "transactional").getTime()).toBe(now.getTime())
  })

  it("accepts a Date or an ISO string", () => {
    const t = new Date(ms(-5_000))
    expect(clampOccurredAt(t, now, "behavioral").getTime()).toBe(t.getTime())
    expect(clampOccurredAt(t.toISOString(), now, "behavioral").getTime()).toBe(t.getTime())
  })
})
