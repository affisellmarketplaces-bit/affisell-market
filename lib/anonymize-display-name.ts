/** GDPR-safe partner label — "Marc Dupont" → "Marc D." */
export function anonymizeDisplayName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = capitalizeWord(parts[0]!)
    const lastInitial = parts[parts.length - 1]!.charAt(0).toUpperCase()
    if (!first || !lastInitial) return null
    return `${first} ${lastInitial}.`
  }

  const single = parts[0]!
  if (single.length <= 2) return `${single.charAt(0).toUpperCase()}.`
  const first = capitalizeWord(single)
  return first ? `${first.charAt(0)}.` : null
}

function capitalizeWord(word: string): string {
  const w = word.trim()
  if (!w) return ""
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
}
