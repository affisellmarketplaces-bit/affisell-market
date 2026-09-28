/**
 * Buyer's manually-chosen "ship to" country — a browsing/filter convenience only (pre-fills the
 * existing `shipsTo` catalog filter). Never touches checkout/payment-country eligibility: that stays
 * strictly IP-resolved server-side (`resolveVisitorCountryIso2`) for compliance — a visitor cannot use
 * this to unlock Stripe checkout in a country Affisell hasn't actually rolled out for them.
 */
export const SHIPS_TO_COOKIE = "affisell_ships_to"

const ISO2_RE = /^[A-Z]{2}$/

const MAX_AGE_SEC = 60 * 60 * 24 * 180 // 180 days, same order as the locale cookie

export function isValidShipsToCode(code: string): boolean {
  return ISO2_RE.test(code)
}

/** Client-only — cookie-only read, safe for a small header widget (no message bundle import). */
export function readShipsToFromDocumentCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${SHIPS_TO_COOKIE}=([A-Z]{2})`))
  const code = match?.[1] ?? null
  return code && isValidShipsToCode(code) ? code : null
}

export function writeShipsToDocumentCookie(code: string): void {
  if (typeof document === "undefined") return
  const normalized = code.trim().toUpperCase()
  if (!isValidShipsToCode(normalized)) return
  document.cookie = `${SHIPS_TO_COOKIE}=${normalized};path=/;max-age=${MAX_AGE_SEC};SameSite=Lax`
}

/**
 * Buyer's chosen city — display/personalization only (e.g. "Ship to: Paris, France" in the
 * trigger). There is no city-level shipping field on Product, so this never filters the catalog
 * — only the country does, via the existing `shipsTo` param.
 */
export const SHIPS_TO_CITY_COOKIE = "affisell_ships_to_city"

const MAX_CITY_LEN = 80

export function isValidShipsToCity(city: string): boolean {
  const trimmed = city.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_CITY_LEN
}

export function readShipsToCityFromDocumentCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${SHIPS_TO_CITY_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null
  try {
    const decoded = decodeURIComponent(match[1])
    return isValidShipsToCity(decoded) ? decoded : null
  } catch {
    return null
  }
}

export function writeShipsToCityDocumentCookie(city: string): void {
  if (typeof document === "undefined") return
  const trimmed = city.trim()
  if (!isValidShipsToCity(trimmed)) return
  document.cookie = `${SHIPS_TO_CITY_COOKIE}=${encodeURIComponent(trimmed)};path=/;max-age=${MAX_AGE_SEC};SameSite=Lax`
}

export function clearShipsToCityDocumentCookie(): void {
  if (typeof document === "undefined") return
  document.cookie = `${SHIPS_TO_CITY_COOKIE}=;path=/;max-age=0;SameSite=Lax`
}
