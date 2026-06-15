export const GRADUATION_EMAIL_STALL_MS = 48 * 60 * 60 * 1000

export type GraduationEmailStallRow = {
  countryIso2: string
  graduatedAt: Date
}

export function findGraduationEmailStalls(
  rows: GraduationEmailStallRow[],
  now = Date.now(),
  stallMs = GRADUATION_EMAIL_STALL_MS
): GraduationEmailStallRow[] {
  const stallBefore = now - stallMs
  return rows.filter((row) => row.graduatedAt.getTime() <= stallBefore)
}
