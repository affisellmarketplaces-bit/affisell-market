import { describe, expect, it } from "vitest"

import { CHANNELS, classifyChannel, isChannel, type ClassifyChannelInput } from "@/lib/events/channel"

const cases: Array<[string, ClassifyChannelInput, string]> = [
  ["nothing at all", {}, "direct"],
  ["empty strings are nothing", { utmSource: " ", utmMedium: "", referrerHost: "" }, "direct"],

  ["creator link wins over everything", { isCreatorLink: true, utmMedium: "cpc", utmSource: "google", referrerHost: "google.com" }, "creator_link"],

  ["cpc medium", { utmMedium: "cpc", utmSource: "google" }, "paid"],
  ["paid social medium beats the social source", { utmMedium: "paid_social", utmSource: "facebook" }, "paid"],
  ["Google Ads click platform", { clickPlatform: "google_ads" }, "paid"],
  ["case-insensitive", { utmMedium: "CPC" }, "paid"],

  ["email medium", { utmMedium: "email", utmSource: "klaviyo" }, "email"],
  ["newsletter source", { utmSource: "newsletter" }, "email"],
  ["webmail referrer", { referrerHost: "mail.google.com" }, "email"],
  ["webmail beats the google search rule", { referrerHost: "mail.google.com", utmMedium: "" }, "email"],

  ["social medium", { utmMedium: "social", utmSource: "x" }, "social"],
  ["social source without medium", { utmSource: "instagram" }, "social"],
  ["Meta click platform", { clickPlatform: "meta" }, "social"],
  ["TikTok click platform", { clickPlatform: "tiktok" }, "social"],
  ["social referrer host", { referrerHost: "l.instagram.com" }, "social"],
  ["t.co referrer", { referrerHost: "t.co" }, "social"],
  ["www is ignored", { referrerHost: "www.facebook.com" }, "social"],

  ["organic medium", { utmMedium: "organic", utmSource: "google" }, "organic_search"],
  ["google referrer", { referrerHost: "www.google.fr" }, "organic_search"],
  ["bing referrer", { referrerHost: "bing.com" }, "organic_search"],
  ["duckduckgo referrer", { referrerHost: "duckduckgo.com" }, "organic_search"],

  ["another site", { referrerHost: "blog.example.org" }, "referral"],
  ["a look-alike of a search engine is a plain referral", { referrerHost: "notgoogle.com" }, "referral"],
  ["a look-alike of a social host is a plain referral", { referrerHost: "evilfacebook.com" }, "referral"],

  ["unknown campaign parameters", { utmSource: "partner-x", utmMedium: "banner-ish" }, "other"],
  ["only a source we do not know", { utmSource: "partner-x" }, "other"],
  ["only a click platform we do not know", { clickPlatform: "other" }, "other"],
]

describe("classifyChannel — deterministic, no score", () => {
  it.each(cases)("%s → %s", (_label, input, expected) => {
    expect(classifyChannel(input)).toBe(expected)
  })

  it("only ever returns a known channel", () => {
    for (const [, input] of cases) expect(CHANNELS).toContain(classifyChannel(input))
  })

  it("is a pure function of its input", () => {
    const input = { utmMedium: "email", referrerHost: "mail.google.com" }
    expect(classifyChannel(input)).toBe(classifyChannel({ ...input }))
  })

  it("isChannel guards untrusted values", () => {
    expect(isChannel("social")).toBe(true)
    expect(isChannel("Social")).toBe(false)
    expect(isChannel("tiktok")).toBe(false)
    expect(isChannel(null)).toBe(false)
  })
})
