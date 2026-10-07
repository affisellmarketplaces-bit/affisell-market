/**
 * Acquisition channel of a visit — a deterministic classification from observable facts (UTM, referrer HOST, the click
 * platform, "came through a creator link"). No score, no inference from behaviour, no learning.
 *
 * Precedence (first match wins):
 *   1. creator_link    the visit came through a creator's share link
 *   2. paid            utm_medium says paid, or the click was tagged by Google Ads
 *   3. email           utm_medium / utm_source say e-mail, or the referrer is a web-mail host
 *   4. social          utm says social, or the source / click platform / referrer host is a social network
 *   5. organic_search  utm_medium=organic, or the referrer is a search engine
 *   6. referral        any other external referrer host
 *   7. other           campaign parameters we do not recognise
 *   8. direct          nothing at all
 *
 * Client-safe (no Prisma). A behavioral concern: it is only ever written on behavioral rows.
 */

export const CHANNELS = ["direct", "organic_search", "social", "email", "paid", "referral", "creator_link", "other"] as const
export type Channel = (typeof CHANNELS)[number]

/** The advertising platform a click identifier (gclid / fbclid / ttclid…) points to. The identifier itself is never stored. */
export type ClickPlatform = "google_ads" | "meta" | "tiktok" | "other"

export type ClassifyChannelInput = {
  utmSource?: string | null
  utmMedium?: string | null
  referrerHost?: string | null
  clickPlatform?: ClickPlatform | null
  isCreatorLink?: boolean
}

const PAID_MEDIUMS = new Set([
  "cpc", "ppc", "paid", "paidsearch", "paid-search", "paid_search", "paidsocial", "paid-social", "paid_social",
  "cpm", "cpv", "display", "retargeting", "remarketing", "banner",
])
const EMAIL_MEDIUMS = new Set(["email", "e-mail", "mail", "newsletter"])
const EMAIL_SOURCES = new Set(["email", "e-mail", "newsletter"])
const SOCIAL_MEDIUMS = new Set(["social", "social-network", "social-media", "social_media", "sm", "smm"])
const SOCIAL_SOURCES = new Set([
  "facebook", "instagram", "tiktok", "twitter", "x", "youtube", "pinterest", "linkedin", "snapchat",
  "reddit", "whatsapp", "telegram", "threads",
])
const SOCIAL_HOSTS = [
  "facebook.com", "fb.com", "instagram.com", "tiktok.com", "twitter.com", "x.com", "t.co", "youtube.com", "youtu.be",
  "pinterest.com", "pinterest.fr", "linkedin.com", "lnkd.in", "snapchat.com", "reddit.com", "whatsapp.com", "wa.me",
  "t.me", "telegram.org", "threads.net",
]
const WEBMAIL_HOSTS = [
  "mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "mail.yahoo.com",
  "mail.proton.me", "webmail.orange.fr", "mail.ru", "mail.aol.com",
]
const SEARCH_ENGINE_RES = [
  /(^|\.)google\.[a-z.]{2,}$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)yahoo\.[a-z.]{2,}$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)qwant\.com$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)yandex\.[a-z.]{2,}$/,
  /(^|\.)brave\.com$/,
]

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function hostIn(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`))
}

export function classifyChannel(input: ClassifyChannelInput): Channel {
  const source = norm(input.utmSource)
  const medium = norm(input.utmMedium)
  const host = norm(input.referrerHost).replace(/^www\./, "")

  if (input.isCreatorLink) return "creator_link"

  if (PAID_MEDIUMS.has(medium) || input.clickPlatform === "google_ads") return "paid"

  if (EMAIL_MEDIUMS.has(medium) || EMAIL_SOURCES.has(source) || (host !== "" && hostIn(host, WEBMAIL_HOSTS))) return "email"

  if (
    SOCIAL_MEDIUMS.has(medium) ||
    SOCIAL_SOURCES.has(source) ||
    input.clickPlatform === "meta" ||
    input.clickPlatform === "tiktok" ||
    (host !== "" && hostIn(host, SOCIAL_HOSTS))
  ) {
    return "social"
  }

  if (medium === "organic" || (host !== "" && SEARCH_ENGINE_RES.some((re) => re.test(host)))) return "organic_search"

  if (host !== "") return "referral"

  if (source !== "" || medium !== "" || input.clickPlatform) return "other"

  return "direct"
}

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value)
}
