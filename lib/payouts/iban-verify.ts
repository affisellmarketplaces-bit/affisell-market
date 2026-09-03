/** ISO 13616 IBAN check-digit validation (mod 97 === 1). */
export function verifyIbanMod97(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, "").toUpperCase()
  if (cleaned.length < 15 || cleaned.length > 34) return false
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) return false

  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55))

  let remainder = numeric
  while (remainder.length > 2) {
    const block = remainder.slice(0, 9)
    remainder = (parseInt(block, 10) % 97).toString() + remainder.slice(block.length)
  }

  return parseInt(remainder, 10) % 97 === 1
}
