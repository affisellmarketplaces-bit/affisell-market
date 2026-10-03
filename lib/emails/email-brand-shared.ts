/**
 * White-label branding for buyer-facing order emails.
 *
 * An order sold through a reseller's storefront should reach the buyer under the STORE's name (sender display name,
 * subject, header, button colour, footer) — not "Affisell". Orders with no store keep the platform identity.
 * Everything here is pure (no DB, no React) so it can be unit-tested and shared by every sender.
 */

import { replaceAffisellBrand } from "@/lib/brand-name-shared"

export type EmailBrand = {
  name: string
  /** False = platform identity (Affisell): every helper below is then a no-op. */
  isStore: boolean
  /** Absolute http(s) URL, or null. */
  logoUrl: string | null
  /** Normalised `#rrggbb`, or null to keep the default accent. */
  primaryColor: string | null
  /** Readable text colour on top of `primaryColor`. */
  onPrimaryColor: string | null
  /** Verified custom domain (host only), shown in the footer when present. */
  siteHost: string | null
}

export const PLATFORM_EMAIL_BRAND: EmailBrand = {
  name: "Affisell",
  isStore: false,
  logoUrl: null,
  primaryColor: null,
  onPrimaryColor: null,
  siteHost: null,
}

const MAX_BRAND_NAME_LENGTH = 60

/** Display name safe to place in a `From:` header and a subject (no control chars, quotes, angle brackets, commas…). */
export function sanitizeBrandName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f<>"\\;,@]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_BRAND_NAME_LENGTH)
    .trim()
  return cleaned.length >= 2 ? cleaned : null
}

/** `#abc` / `#aabbcc` (any case) → `#aabbcc`; anything else → null. */
export function sanitizeHexColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(raw.trim())
  if (!m) return null
  const hex = m[1]!.toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex}`
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function readableTextOn(hex: string): "#ffffff" | "#111827" {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  return lum > 0.4 ? "#111827" : "#ffffff"
}

export function sanitizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim()
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(t)) return null
  return t
}

export function brandFooterLine(brand: EmailBrand): string {
  return brand.siteHost ? `${brand.name} — ${brand.siteHost}` : brand.name
}

const PLATFORM_FOOTER_RE = /Affisell\s*[—–-]\s*affisell-market\.vercel\.app/gi
/** Replaces the platform footer and any remaining "Affisell" mention by the store brand. No-op for the platform. */
export function applyBrandToText(text: string, brand: EmailBrand): string {
  if (!brand.isStore) return text
  return replaceAffisellBrand(text.replace(PLATFORM_FOOTER_RE, () => brandFooterLine(brand)), brand.name)
}

/** `applyBrandToText` over every string field of an email copy object. */
export function applyBrandToCopy<T extends Record<string, unknown>>(copy: T, brand: EmailBrand): T {
  if (!brand.isStore) return copy
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(copy)) {
    out[key] = typeof value === "string" ? applyBrandToText(value, brand) : value
  }
  return out as T
}

/**
 * `Store name <orders@platform-domain>` — same verified sending address (so deliverability is unchanged), different
 * display name. Platform brand returns the configured sender untouched.
 */
export function buildBrandedFrom(baseFrom: string, brand: EmailBrand): string {
  if (!brand.isStore) return baseFrom
  const angle = /<([^<>]+)>\s*$/.exec(baseFrom)
  const address = (angle ? angle[1]! : baseFrom).trim()
  if (!address.includes("@")) return baseFrom
  return `${brand.name} <${address}>`
}

/** Props for the React Email templates; undefined for the platform so templates render exactly as before. */
export function toEmailBrandProps(
  brand: EmailBrand
): { name: string; logoUrl: string | null; primaryColor: string | null; buttonTextColor: string | null } | undefined {
  if (!brand.isStore) return undefined
  return {
    name: brand.name,
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    buttonTextColor: brand.onPrimaryColor,
  }
}
