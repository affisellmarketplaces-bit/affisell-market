import { prisma } from "@/lib/prisma"

export type BookingFounderStats = {
  confirmed7d: number
  confirmed30d: number
  experienceShare30dPct: number
  pendingCheckInsToday: number
  checkInRate7dPct: number | null
  hourEmailReminders7d: number
  hourSmsReminders7d: number
  noShowGuests7d: number
}

const ACTIVE_BOOKING_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"]

export async function loadBookingFounderStats(now = new Date()): Promise<BookingFounderStats> {
  const d7 = new Date(now.getTime() - 7 * 86_400_000)
  const d30 = new Date(now.getTime() - 30 * 86_400_000)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const bookingBase = {
    bookingConfirmedAt: { not: null as null },
    bookingCancelledAt: null,
    status: { in: ACTIVE_BOOKING_STATUSES },
  }

  const [
    confirmed7d,
    confirmed30d,
    experience30d,
    pendingToday,
    hourEmail7d,
    hourSms7d,
    pastSlotOrders7d,
  ] = await Promise.all([
    prisma.order.count({ where: { ...bookingBase, bookingConfirmedAt: { gte: d7 } } }),
    prisma.order.count({ where: { ...bookingBase, bookingConfirmedAt: { gte: d30 } } }),
    prisma.order.count({
      where: {
        ...bookingBase,
        bookingConfirmedAt: { gte: d30 },
        listingKindSnapshot: "EXPERIENCE",
      },
    }),
    prisma.order.count({
      where: {
        ...bookingBase,
        bookingCheckedInAt: null,
        bookingSlot: { startsAt: { gte: todayStart, lte: todayEnd } },
      },
    }),
    prisma.order.count({
      where: { bookingReminderHourSentAt: { gte: d7 } },
    }),
    prisma.order.count({
      where: { bookingReminderHourSmsSentAt: { gte: d7 } },
    }),
    prisma.order.findMany({
      where: {
        ...bookingBase,
        bookingConfirmedAt: { gte: d7 },
        bookingSlot: { startsAt: { lt: now } },
      },
      select: {
        quantity: true,
        bookingCheckedInAt: true,
      },
      take: 2000,
    }),
  ])

  let pastGuests = 0
  let pastCheckedIn = 0
  let noShowGuests7d = 0
  for (const row of pastSlotOrders7d) {
    const qty = Math.max(1, row.quantity)
    pastGuests += qty
    if (row.bookingCheckedInAt) pastCheckedIn += qty
    else noShowGuests7d += qty
  }

  const stats: BookingFounderStats = {
    confirmed7d,
    confirmed30d,
    experienceShare30dPct:
      confirmed30d > 0 ? Math.round((experience30d / confirmed30d) * 100) : 0,
    pendingCheckInsToday: pendingToday,
    checkInRate7dPct: pastGuests > 0 ? Math.round((pastCheckedIn / pastGuests) * 100) : null,
    hourEmailReminders7d: hourEmail7d,
    hourSmsReminders7d: hourSms7d,
    noShowGuests7d,
  }

  console.log("[booking-founder]", { result: "stats_loaded", ...stats })
  return stats
}
