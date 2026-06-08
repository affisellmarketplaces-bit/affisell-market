const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/** J-1 window: 22–26 h before slot start (cron every 30 min). */
export const BOOKING_REMINDER_DAY_MIN_MS = 22 * HOUR_MS
export const BOOKING_REMINDER_DAY_MAX_MS = 26 * HOUR_MS

/** H-2 window: 90–150 min before slot start. */
export const BOOKING_REMINDER_HOUR_MIN_MS = 90 * MINUTE_MS
export const BOOKING_REMINDER_HOUR_MAX_MS = 150 * MINUTE_MS

export function msUntilBookingStart(startsAt: Date, now: Date): number {
  return startsAt.getTime() - now.getTime()
}

export function isInDayReminderWindow(startsAt: Date, now: Date): boolean {
  const ms = msUntilBookingStart(startsAt, now)
  return ms >= BOOKING_REMINDER_DAY_MIN_MS && ms <= BOOKING_REMINDER_DAY_MAX_MS
}

export function isInHourReminderWindow(startsAt: Date, now: Date): boolean {
  const ms = msUntilBookingStart(startsAt, now)
  return ms >= BOOKING_REMINDER_HOUR_MIN_MS && ms <= BOOKING_REMINDER_HOUR_MAX_MS
}

export function dayReminderSlotRange(now: Date): { gte: Date; lte: Date } {
  return {
    gte: new Date(now.getTime() + BOOKING_REMINDER_DAY_MIN_MS),
    lte: new Date(now.getTime() + BOOKING_REMINDER_DAY_MAX_MS),
  }
}

export function hourReminderSlotRange(now: Date): { gte: Date; lte: Date } {
  return {
    gte: new Date(now.getTime() + BOOKING_REMINDER_HOUR_MIN_MS),
    lte: new Date(now.getTime() + BOOKING_REMINDER_HOUR_MAX_MS),
  }
}
