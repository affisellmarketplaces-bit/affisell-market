import { describe, expect, it } from "vitest"

import {
  PLATFORM_EMAIL_BRAND,
  applyBrandToCopy,
  applyBrandToText,
  brandFooterLine,
  buildBrandedFrom,
  readableTextOn,
  sanitizeBrandName,
  sanitizeHexColor,
  sanitizeHttpUrl,
  toEmailBrandProps,
  type EmailBrand,
} from "@/lib/emails/email-brand-shared"

const store: EmailBrand = {
  name: "Maison Léa",
  isStore: true,
  logoUrl: "https://cdn.example.com/lea.png",
  primaryColor: "#be185d",
  onPrimaryColor: "#ffffff",
  siteHost: "maison-lea.com",
}

describe("sanitizeBrandName", () => {
  it("keeps a normal name and trims/collapses whitespace", () => {
    expect(sanitizeBrandName("  Maison   Léa ")).toBe("Maison Léa")
  })

  it("removes characters that could break or spoof a From header", () => {
    expect(sanitizeBrandName('Boutique "VIP" <evil@x.com>, Inc;')).toBe("Boutique VIP evil x.com Inc")
    expect(sanitizeBrandName("Line1\r\nBcc: a@b.c")).toBe("Line1 Bcc: a b.c")
  })

  it("caps the length and rejects empty / non-string input", () => {
    expect(sanitizeBrandName("x".repeat(200))!.length).toBe(60)
    expect(sanitizeBrandName("a")).toBeNull()
    expect(sanitizeBrandName("   ")).toBeNull()
    expect(sanitizeBrandName(null)).toBeNull()
    expect(sanitizeBrandName(42)).toBeNull()
  })
})

describe("colours", () => {
  it("normalises hex and rejects anything else (no CSS injection)", () => {
    expect(sanitizeHexColor("#ABC")).toBe("#aabbcc")
    expect(sanitizeHexColor(" #7C3AED ")).toBe("#7c3aed")
    expect(sanitizeHexColor("red")).toBeNull()
    expect(sanitizeHexColor("#12345")).toBeNull()
    expect(sanitizeHexColor("#fff;background:url(x)")).toBeNull()
    expect(sanitizeHexColor(undefined)).toBeNull()
  })

  it("picks readable text for a filled button", () => {
    expect(readableTextOn("#111111")).toBe("#ffffff")
    expect(readableTextOn("#be185d")).toBe("#ffffff")
    expect(readableTextOn("#ffffff")).toBe("#111827")
    expect(readableTextOn("#fde047")).toBe("#111827")
  })
})

describe("sanitizeHttpUrl", () => {
  it("accepts http(s) urls only", () => {
    expect(sanitizeHttpUrl("https://a.b/c.png")).toBe("https://a.b/c.png")
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull()
    expect(sanitizeHttpUrl("data:image/png;base64,AAA")).toBeNull()
    expect(sanitizeHttpUrl("/relative.png")).toBeNull()
    expect(sanitizeHttpUrl('https://a.b/"onerror=')).toBeNull()
  })
})

describe("applyBrandToText / applyBrandToCopy", () => {
  it("is a strict no-op for the platform brand", () => {
    const t = "Affisell — affisell-market.vercel.app"
    expect(applyBrandToText(t, PLATFORM_EMAIL_BRAND)).toBe(t)
    const copy = { footer: t, n: 1 }
    expect(applyBrandToCopy(copy, PLATFORM_EMAIL_BRAND)).toBe(copy)
  })

  it("swaps the platform footer for the store line without leaking the platform domain", () => {
    expect(applyBrandToText("Affisell — affisell-market.vercel.app", store)).toBe("Maison Léa — maison-lea.com")
    expect(applyBrandToText("Affisell - affisell-market.vercel.app", { ...store, siteHost: null })).toBe("Maison Léa")
  })

  it("replaces the brand word in subjects and body copy, whole word only", () => {
    expect(applyBrandToText("Commande Affisell #AB12 confirmée", store)).toBe("Commande Maison Léa #AB12 confirmée")
    expect(applyBrandToText("Affisell order #X confirmed", store)).toBe("Maison Léa order #X confirmed")
    expect(applyBrandToText("affisellfoo and Affiselling", store)).toBe("affisellfoo and Affiselling")
  })

  it("does not interpret $ patterns in a store name", () => {
    expect(applyBrandToText("Hello Affisell", { ...store, name: "Cash $& Co" })).toBe("Hello Cash $& Co")
  })

  it("maps every string field of a copy object and leaves other values alone", () => {
    const out = applyBrandToCopy(
      { preview: "Commande Affisell #1", footer: "Affisell — affisell-market.vercel.app", count: 3 },
      store
    )
    expect(out).toEqual({ preview: "Commande Maison Léa #1", footer: "Maison Léa — maison-lea.com", count: 3 })
  })

  it("builds the footer line", () => {
    expect(brandFooterLine(store)).toBe("Maison Léa — maison-lea.com")
    expect(brandFooterLine({ ...store, siteHost: null })).toBe("Maison Léa")
  })
})

describe("buildBrandedFrom", () => {
  it("keeps the verified sending address and only changes the display name", () => {
    expect(buildBrandedFrom("Affisell <noreply@affisell.com>", store)).toBe("Maison Léa <noreply@affisell.com>")
    expect(buildBrandedFrom("noreply@affisell.com", store)).toBe("Maison Léa <noreply@affisell.com>")
    expect(buildBrandedFrom("Affisell <onboarding@resend.dev>", store)).toBe("Maison Léa <onboarding@resend.dev>")
  })

  it("returns the configured sender untouched for the platform or an unusable base", () => {
    expect(buildBrandedFrom("Affisell <noreply@affisell.com>", PLATFORM_EMAIL_BRAND)).toBe("Affisell <noreply@affisell.com>")
    expect(buildBrandedFrom("not-an-address", store)).toBe("not-an-address")
  })
})

describe("toEmailBrandProps", () => {
  it("is undefined for the platform so templates render exactly as before", () => {
    expect(toEmailBrandProps(PLATFORM_EMAIL_BRAND)).toBeUndefined()
  })

  it("exposes only what the templates need for a store", () => {
    expect(toEmailBrandProps(store)).toEqual({
      name: "Maison Léa",
      logoUrl: "https://cdn.example.com/lea.png",
      primaryColor: "#be185d",
      buttonTextColor: "#ffffff",
    })
  })
})
