/** "12,50" / "12.5" / "12" → 1250 cents; anything else → null (never guessed). Pure, client-safe. */
export function eurosToCents(text: string): number | null {
  const t = text.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

export function centsToEuroText(cents: number | null | undefined): string {
  if (cents == null) return ""
  return (cents / 100).toFixed(2).replace(".", ",")
}
