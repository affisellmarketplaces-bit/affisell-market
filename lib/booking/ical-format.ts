export function escapeIcal(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

export function formatIcalUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

export function buildIcalCalendar(events: string[], calendarName: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Affisell//Booking//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n")
}
