export type GraduatedThisMonthRow = {
  countryIso2: string
  graduatedAt: string
}

export function buildGraduatedThisMonthDigestLines(
  graduatedThisMonth: number,
  countries: GraduatedThisMonthRow[],
  label: (countryIso2: string) => string,
  browseUrl?: (countryIso2: string) => string
): string[] {
  if (graduatedThisMonth === 0) {
    return ["Graduated this month: 0", "• none"]
  }

  return [
    `Graduated this month: ${graduatedThisMonth}`,
    ...countries.map((row) => {
      const base = `• ${label(row.countryIso2)} (${row.countryIso2}) — ${row.graduatedAt.slice(0, 10)}`
      const url = browseUrl?.(row.countryIso2)
      return url ? `${base}\n  Shop: ${url}` : base
    }),
  ]
}
