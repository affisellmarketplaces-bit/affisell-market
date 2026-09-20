/** Pure helpers for customer invoice numbers — `YYYY-ISSUER-000001`, continuous per issuer and year. */

export const PLATFORM_ISSUER_KEY = "PLATFORM"

/** Short stable code of an issuer (last 6 chars of its id, upper-cased) — the platform itself is `AFF`. */
export function issuerCode(issuerKey: string): string {
  if (issuerKey === PLATFORM_ISSUER_KEY) return "AFF"
  const cleaned = issuerKey.replace(/[^a-z0-9]/gi, "").toUpperCase()
  return cleaned.slice(-6) || "AFF"
}

export function formatInvoiceNumber(issuerKey: string, year: number, sequence: number): string {
  return `${year}-${issuerCode(issuerKey)}-${String(Math.max(1, Math.floor(sequence))).padStart(6, "0")}`
}
