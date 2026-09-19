/** Splits a long listing title into a headline and a subtitle (client-safe, no dependencies). */
export function splitListingTitle(name: string): { headline: string; subline: string | null } {
  const trimmed = name.trim()
  if (!trimmed) return { headline: "", subline: null }

  const comma = trimmed.indexOf(",")
  if (comma >= 12 && comma <= 96) {
    const headline = trimmed.slice(0, comma).trim()
    const subline = trimmed.slice(comma + 1).trim()
    if (headline.length >= 8 && subline.length >= 10) {
      return { headline, subline }
    }
  }

  const dash = trimmed.match(/^(.{12,72})\s[-–—]\s+(.{8,})$/u)
  if (dash) {
    return { headline: dash[1].trim(), subline: dash[2].trim() }
  }

  if (trimmed.length > 78) {
    const cut = trimmed.lastIndexOf(" ", 78)
    if (cut >= 28) {
      return { headline: trimmed.slice(0, cut).trim(), subline: trimmed.slice(cut).trim() }
    }
  }

  return { headline: trimmed, subline: null }
}
