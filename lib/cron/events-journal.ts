import "server-only"

import { isJournalEnabled, projectBusinessJournal } from "@/lib/events/journal-projector.server"

/** Overlapping window: each run re-reads the last 3 days, so a missed run or a late row is caught (idempotent). */
export const EVENTS_JOURNAL_WINDOW_DAYS = 3

export async function runEventsJournalCron(now = new Date()) {
  if (!isJournalEnabled()) return { enabled: false as const, skipped: "EVENTS_JOURNAL is not on" }
  const since = new Date(now.getTime() - EVENTS_JOURNAL_WINDOW_DAYS * 86_400_000)
  return projectBusinessJournal({ since, until: now })
}
