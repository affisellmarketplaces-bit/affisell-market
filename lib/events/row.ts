/**
 * Turns an event someone wants to record into the row that may actually be stored — or into a reason why it must not
 * be. PURE: no database, no clock (the caller passes `now`), so every rule below is unit-tested without mocks.
 *
 * This is where the two classes are kept apart:
 *   behavioral    refused without analytics consent; keeps its visitor identifiers and channel.
 *   transactional recorded whatever the visitor's cookie choices are; ALL visitor identifiers (anonymousId, sessionId),
 *                 the marketing channel and the behavioral duration are stripped before storage.
 * The database repeats the second rule as a CHECK constraint, so a future code path that forgets it still cannot
 * store a visitor identifier on a business row.
 *
 * Client-safe (no Prisma).
 */
import { isChannel } from "@/lib/events/channel"
import { EVENT_REGISTRY, isEventName, type EventClass, type EventName } from "@/lib/events/names"
import { sanitizeProperties } from "@/lib/events/properties"
import {
  clampOccurredAt,
  sanitizeAnonymousId,
  sanitizeCountry,
  sanitizeEventId,
  sanitizeId,
  sanitizeInt,
  sanitizeLocale,
  sanitizeSessionId,
  sanitizeSlug,
} from "@/lib/events/sanitize"

export const EVENT_SCHEMA_VERSION = 1

export type ServerEventInput = {
  /** Idempotency key (see AffisellTrackEvent.eventId). Required for EVERY event: no key, no event. */
  eventId: string
  name: string
  occurredAt?: Date | number | string | null
  userId?: string | null
  anonymousId?: string | null
  sessionId?: string | null
  productId?: string | null
  listingId?: string | null
  storeId?: string | null
  creatorId?: string | null
  supplierId?: string | null
  orderId?: string | null
  source?: string | null
  channel?: string | null
  country?: string | null
  locale?: string | null
  durationMs?: number | null
  properties?: unknown
}

export type RecordContext = {
  /** Does the visitor allow analytics? Server-side truth (consent cookie), never a client claim. */
  analyticsConsent: boolean
  now?: Date
}

export type EventRow = {
  eventId: string
  eventType: EventName
  eventClass: EventClass
  occurredAt: Date
  userId: string | null
  anonymousId: string | null
  sessionId: string | null
  productId: string | null
  listingId: string | null
  storeId: string | null
  creatorId: string | null
  supplierId: string | null
  orderId: string | null
  source: string | null
  channel: string | null
  country: string | null
  locale: string | null
  durationMs: number | null
  schemaVersion: typeof EVENT_SCHEMA_VERSION
  properties: Record<string, string | number | boolean> | null
}

/** `malformed`: not even an object (null, a string…) — nothing to read a name or a key from. */
export type DropReason = "malformed" | "unknown_event" | "invalid_event_id" | "no_consent"

export type BuildResult = { ok: true; row: EventRow } | { ok: false; reason: DropReason }

export function buildEventRow(input: ServerEventInput, ctx: RecordContext): BuildResult {
  if (!input || typeof input !== "object") return { ok: false, reason: "malformed" }
  if (!isEventName(input.name)) return { ok: false, reason: "unknown_event" }
  const name = input.name
  const eventClass = EVENT_REGISTRY[name].class

  const eventId = sanitizeEventId(input.eventId)
  if (!eventId) return { ok: false, reason: "invalid_event_id" }

  if (eventClass === "behavioral" && !ctx.analyticsConsent) return { ok: false, reason: "no_consent" }

  const now = ctx.now ?? new Date()
  const behavioral = eventClass === "behavioral"

  return {
    ok: true,
    row: {
      eventId,
      eventType: name,
      eventClass,
      occurredAt: clampOccurredAt(input.occurredAt, now, eventClass),
      userId: sanitizeId(input.userId),
      // Visitor identifiers, marketing channel and behavioral duration exist ONLY on behavioral rows.
      anonymousId: behavioral ? sanitizeAnonymousId(input.anonymousId) : null,
      sessionId: behavioral ? sanitizeSessionId(input.sessionId) : null,
      channel: behavioral && isChannel(input.channel) ? input.channel : null,
      durationMs: behavioral ? sanitizeInt(input.durationMs, 0, 600_000) : null,
      productId: sanitizeId(input.productId),
      listingId: sanitizeId(input.listingId),
      storeId: sanitizeId(input.storeId),
      creatorId: sanitizeId(input.creatorId),
      supplierId: sanitizeId(input.supplierId),
      orderId: sanitizeId(input.orderId),
      source: sanitizeSlug(input.source),
      country: sanitizeCountry(input.country),
      locale: sanitizeLocale(input.locale),
      schemaVersion: EVENT_SCHEMA_VERSION,
      properties: sanitizeProperties(name, input.properties),
    },
  }
}
