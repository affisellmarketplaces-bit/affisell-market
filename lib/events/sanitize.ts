/**
 * Sanitizers for everything that reaches the event table. Data minimisation lives HERE, in pure functions, so it is
 * the same for every writer (browser beacon, webhook, route) and is unit-tested once.
 *
 * Rules of thumb: never store a URL path or query, an e-mail, a phone number, an address or a free-text blob; keep an
 * identifier only if it has the shape of an identifier; when in doubt, drop the value (never the whole event).
 *
 * Client-safe (no Prisma).
 */
import { isValidGtin } from "@/lib/listing-compliance/gtin"

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g

/** Internal ids (cuid, uuid, Stripe ids…): URL-safe characters only. */
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/
/** Idempotency keys may also carry `:` and `.` (`purchase:{orderId}`, `{stripeSessionId}:line:0`). */
const EVENT_ID_RE = /^[A-Za-z0-9:_.-]{8,200}$/
const ANONYMOUS_ID_RE = /^[A-Za-z0-9_-]{16,64}$/
const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/

/** Tabs and line breaks (including the Unicode ones) separate words: they become a space, they must not glue words together. */
const WORD_SEPARATORS = new RegExp("[\\t\\n\\r\\u000b\\u000c\\u0085\\u2028\\u2029]", "g")

/** Removes control characters; whitespace-like ones become a space first. */
export function stripControlChars(value: string): string {
  return value.replace(WORD_SEPARATORS, " ").replace(CONTROL_CHARS, "")
}

export function sanitizeId(value: unknown): string | null {
  return typeof value === "string" && ID_RE.test(value.trim()) ? value.trim() : null
}

export function sanitizeEventId(value: unknown): string | null {
  return typeof value === "string" && EVENT_ID_RE.test(value.trim()) ? value.trim() : null
}

export function sanitizeAnonymousId(value: unknown): string | null {
  return typeof value === "string" && ANONYMOUS_ID_RE.test(value.trim()) ? value.trim() : null
}

export function sanitizeSessionId(value: unknown): string | null {
  return typeof value === "string" && SESSION_ID_RE.test(value.trim()) ? value.trim() : null
}

export function sanitizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null
  const v = value.trim().toLowerCase()
  return SLUG_RE.test(v) ? v : null
}

/** ISO 3166-1 alpha-2, upper-cased. */
export function sanitizeCountry(value: unknown): string | null {
  if (typeof value !== "string") return null
  const v = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(v) ? v : null
}

/** `fr`, `fr-FR`… (language lower-cased, region upper-cased), at most 8 characters. */
export function sanitizeLocale(value: unknown): string | null {
  if (typeof value !== "string") return null
  const [lang, region, ...rest] = value.trim().split("-")
  if (rest.length > 0 || !lang || !/^[A-Za-z]{2,3}$/.test(lang)) return null
  if (region !== undefined && !/^[A-Za-z0-9]{2,4}$/.test(region)) return null
  const out = region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase()
  return out.length <= 8 ? out : null
}

// ── Free text ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the spine keeps of a search is the PRODUCT VOCABULARY a buyer used ("lampe de bureau", "iphone 15 pro 256").
 * Anything that looks like an identifier of a person, an account, an order, a payment instrument or a place is not
 * product vocabulary, so the WHOLE query is dropped (fail closed) — never stored half-masked: the surviving words and
 * a placeholder would still describe what was typed. The search itself is not lost: its result_count, position and
 * clicks live in their own fields.
 *
 * This is deliberately NOT a general personal-data detector. A person's NAME cannot be told from a brand ("louis
 * vuitton", "calvin klein", "marie claire") and brands are the core of search intelligence, so names are not filtered;
 * the limits below (≤ 8 words, ≤ 100 characters) and the analytics-consent requirement are what bound that residual.
 */
export const SEARCH_QUERY_MAX_LENGTH = 100
export const SEARCH_QUERY_MAX_WORDS = 8
const MAX_WORD_LENGTH = 32

export type QueryDropReason =
  | "too_long"
  | "too_many_words"
  | "word_too_long"
  | "email"
  | "url"
  | "digit_run"
  | "long_number"
  | "iban"
  | "identifier_token"
  | "street_address"

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const URL_RE = /(?:https?:\/\/|www\.)/i
/** A run of digits possibly broken by spaces / dots / dashes / brackets (phone, card, national id…). */
const DIGIT_RUN_RE = /\+?\d[\d\s().-]{6,}\d/g
/** Spaced or compact IBAN shape: 2 letters, 2 check digits, then 3+ groups of 3–4 characters. */
const IBAN_RE = /\b[a-z]{2}\d{2}(?:\s?[a-z0-9]{3,4}){3,8}\b/
// Built with `new RegExp` (Unicode property escapes in a regex LITERAL need a newer TS target than this project's ES2017).
/** "12 rue des lilas", "12 main street", "5 avenue" — number first. */
const STREET_NUMBER_FIRST_RE = new RegExp(
  String.raw`\b\d{1,4}\s*(?:bis|ter)?\s+(?:[\p{L}'’.-]+\s+){0,3}(?:rue|avenue|boulevard|chemin|impasse|all[ée]e|quai|street|road|lane|strasse|straße|straat|laan|calle|carrer|via)\b`,
  "iu"
)
/** "rue des lilas 12", "via roma 12", "calle mayor 5" — number last (only types that are not everyday product words). */
const STREET_NUMBER_LAST_RE = new RegExp(String.raw`\b(?:rue|chemin|impasse|via|calle|carrer)\s+(?:[\p{L}'’.-]+\s+){0,4}\d{1,4}\b`, "iu")
/** "hauptstraße 12", "kerkstraat 3". */
const STREET_COMPOUND_RE = new RegExp(String.raw`\p{L}{3,}(?:strasse|straße|straat|laan|gasse)\s*\d{1,4}\b`, "iu")
const NON_WORD_RE = new RegExp(String.raw`[^\p{L}\p{N}]+`, "u")
const LETTER_RE = new RegExp(String.raw`\p{L}`, "u")

/** Why a (normalised, lower-case) query must not be stored, or null when it is acceptable product vocabulary. */
export function queryDropReason(text: string): QueryDropReason | null {
  if (text.length > SEARCH_QUERY_MAX_LENGTH) return "too_long"
  const words = text.split(" ").filter(Boolean)
  if (words.length > SEARCH_QUERY_MAX_WORDS) return "too_many_words"

  if (EMAIL_RE.test(text)) return "email"
  if (URL_RE.test(text)) return "url"

  // A barcode is a legitimate, useful query: a digit run that is a VALID GTIN (check digit verified) is kept.
  for (const run of text.match(DIGIT_RUN_RE) ?? []) {
    const digits = run.replace(/\D/g, "")
    if (digits.length < 8) continue
    const pureDigits = /^\d+$/.test(run.trim())
    if (!(pureDigits && isValidGtin(digits))) return "digit_run"
  }

  if (IBAN_RE.test(text)) return "iban"

  for (const token of text.split(NON_WORD_RE).filter(Boolean)) {
    if (token.length > MAX_WORD_LENGTH) return "word_too_long"
    // Postal codes, order numbers, parcel and account numbers: 5+ digits that are not a valid barcode.
    if (/^\d{5,}$/.test(token) && !isValidGtin(token)) return "long_number"
    // Order references, tracking numbers, tokens, session ids: long and mixing letters with digits.
    if (token.length >= 12 && /\d/.test(token) && LETTER_RE.test(token)) return "identifier_token"
  }

  if (STREET_NUMBER_FIRST_RE.test(text) || STREET_NUMBER_LAST_RE.test(text) || STREET_COMPOUND_RE.test(text)) {
    return "street_address"
  }
  return null
}

/** A search query as stored: normalised (NFKC, lower-case, single spaces) and ≤ 100 characters — or null (nothing stored). */
export function sanitizeSearchQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const text = stripControlChars(raw).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
  if (text.length === 0) return null
  return queryDropReason(text) === null ? text : null
}

// ── Acquisition parameters ───────────────────────────────────────────────────────────────────────────────────────

const UTM_MAX_LENGTH = 64

/**
 * A UTM value: lower-case, restricted alphabet, ≤ 64 characters. A value containing `@` is DROPPED (e-mail campaigns
 * sometimes put the recipient's address in utm_content).
 */
export function sanitizeUtm(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const v = stripControlChars(raw).trim().toLowerCase()
  if (v.length === 0 || v.includes("@")) return null
  const cleaned = v.replace(/[^a-z0-9._~:+\- ]/g, "").replace(/\s+/g, " ").trim().slice(0, UTM_MAX_LENGTH).trim()
  return cleaned.length > 0 ? cleaned : null
}

/**
 * The HOST of an external referrer — never its path or query. Own hosts (and `localhost`) are dropped: navigating
 * inside Affisell is not an acquisition. `ownHosts` is passed in so this stays pure.
 */
export function sanitizeReferrerHost(referrer: unknown, ownHosts: readonly string[] = []): string | null {
  if (typeof referrer !== "string" || referrer.trim().length === 0) return null
  let host: string
  try {
    const url = new URL(referrer.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    host = url.hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
  if (host.length === 0 || host.length > 100 || host === "localhost") return null
  const own = ownHosts.map((h) => h.toLowerCase().replace(/^www\./, "")).filter(Boolean)
  if (own.some((o) => host === o || host.endsWith(`.${o}`))) return null
  return host
}

// ── Time ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Behavioral events come from browsers (wrong clocks, replays): accept a short window around "now". */
export const BEHAVIORAL_PAST_MS = DAY
/** Transactional events carry the ledger's own date; a backfill may legitimately reach far back. */
export const TRANSACTIONAL_PAST_MS = 10 * 365 * DAY
export const FUTURE_TOLERANCE_MS = 5 * MINUTE

/**
 * The time an event is attributed to. Anything missing, invalid or outside the accepted window becomes `now`
 * (the ingestion time) instead of poisoning ordering with a client's bad clock.
 */
export function clampOccurredAt(
  value: Date | number | string | null | undefined,
  now: Date,
  eventClass: "behavioral" | "transactional"
): Date {
  if (value === null || value === undefined) return now
  const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value)
  if (!Number.isFinite(ms)) return now
  const past = eventClass === "behavioral" ? BEHAVIORAL_PAST_MS : TRANSACTIONAL_PAST_MS
  if (ms > now.getTime() + FUTURE_TOLERANCE_MS || ms < now.getTime() - past) return now
  return new Date(ms)
}

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function sanitizeInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^-?\d{1,12}$/.test(value.trim()) ? Number(value) : NaN
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
