/** GTIN (EAN / UPC) helpers — GS1 mod-10 check digit. Client-safe. */

export const GTIN_LENGTHS = [8, 12, 13, 14] as const

/** Digits only: "978-3-16-148410-0" → "9783161484100". */
export function normalizeGtin(raw: string): string {
  return raw.replace(/[\s\-.]/g, "")
}

export function gtinCheckDigit(bodyDigits: string): number {
  // From the right of the body, weights alternate 3,1,3,1…
  let sum = 0
  for (let i = bodyDigits.length - 1, w = 3; i >= 0; i -= 1, w = w === 3 ? 1 : 3) {
    sum += Number(bodyDigits[i]) * w
  }
  return (10 - (sum % 10)) % 10
}

export function isValidGtin(raw: string): boolean {
  const g = normalizeGtin(raw)
  if (!/^\d+$/.test(g)) return false
  if (!(GTIN_LENGTHS as readonly number[]).includes(g.length)) return false
  return gtinCheckDigit(g.slice(0, -1)) === Number(g[g.length - 1])
}
