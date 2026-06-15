export type GraduatedThisMonthRow = {
  countryIso2: string
  graduatedAt: string
}

export function buildGraduatedThisMonthDigestLines(
  graduatedThisMonth: number,
  countries: GraduatedThisMonthRow[],
  label: (countryIso2: string) => string
): string[] {
  if (graduatedThisMonth === 0) {
    return ["Graduated this month: 0", "• none"]
  }

  return [
    `Graduated this month: ${graduatedThisMonth}`,
    ...countries.map(
      (row) =>
        `• ${label(row.countryIso2)} (${row.countryIso2}) — ${row.graduatedAt.slice(0, 10)}`
    ),
  ]
}
