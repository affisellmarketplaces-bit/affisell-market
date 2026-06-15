export type WaitlistCountryDemand = {
  countryIso2: string
  waitlistCount: number
}

/** Next ROW pilot country by waitlist rank (1 = top demand not yet enabled). */
export function findNextPilotCountry(
  waitlistByCountry: readonly WaitlistCountryDemand[],
  enabledCountries: ReadonlySet<string>,
  baseCountries: ReadonlySet<string>,
  rank = 1,
  skipCountries?: ReadonlySet<string>
): WaitlistCountryDemand | null {
  const safeRank = Math.max(1, Math.floor(rank))
  const eligible = [...waitlistByCountry]
    .sort((a, b) => b.waitlistCount - a.waitlistCount)
    .filter(
      (row) =>
        !enabledCountries.has(row.countryIso2.toUpperCase()) &&
        !baseCountries.has(row.countryIso2.toUpperCase()) &&
        !(skipCountries?.has(row.countryIso2.toUpperCase()) ?? false)
    )
  return eligible[safeRank - 1] ?? null
}
