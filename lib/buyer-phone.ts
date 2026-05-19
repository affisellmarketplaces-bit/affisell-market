/** Normalize buyer phone to digits with country code (FR-friendly). */
export function normalizeBuyerPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("0") && digits.length === 10) digits = `33${digits.slice(1)}`
  if (digits.length < 9 || digits.length > 15) return null
  return digits
}

/** Stable login email for phone-only buyers (no extra DB column). */
export function buyerEmailFromPhone(normalizedDigits: string): string {
  return `phone+${normalizedDigits}@buyer.affisell.local`
}

export function formatBuyerPhoneDisplay(normalizedDigits: string): string {
  if (normalizedDigits.startsWith("33") && normalizedDigits.length === 11) {
    const local = normalizedDigits.slice(2)
    return `+33 ${local.slice(0, 1)} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`
  }
  return `+${normalizedDigits}`
}
