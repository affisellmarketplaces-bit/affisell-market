/**
 * Conversion-event ingestion (step S3 of docs/CONVERSION-EVENTS-WIRING-PLAN.md) — pure decisions.
 *
 * Founder decisions 2026-11-23: D1 every behavioural write respects analytics consent; D2 no cookie-free counter;
 * D3 raw events 90 days then aggregates only; D4 AGGREGATED measurement only — no individual journey from a visitor
 * to an order. Consequences enforced here:
 *  - nothing is accepted while `CONVERSION_EVENTS_MODE` is not exactly "on" (DEFAULT off: the endpoint reads nothing);
 *  - no consent = nothing parsed, nothing stored;
 *  - a browser event never carries an account id (`userId`) nor a durable visitor id (`anonymousId`): only the tab's
 *    session id, enough to count UNIQUE views per listing (D4) and useless to follow a person across visits;
 *  - obvious robots are not counted.
 */
import type { ClientEvent } from "@/lib/events/schema"
import type { ServerEventInput } from "@/lib/events/row"

export type ConversionEventsMode = "off" | "on"

/** Only the exact word "on" switches ingestion on (founder decision); anything else, or nothing, is off. */
export function readConversionEventsMode(env: Record<string, string | undefined> = process.env): ConversionEventsMode {
  return (env.CONVERSION_EVENTS_MODE ?? "").trim() === "on" ? "on" : "off"
}

const BOT_PATTERN =
  /(bot\b|bot\/|crawler|spider|crawling|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl\/|wget\/|python-requests|httpclient|axios\/|node-fetch|go-http-client|phantomjs|puppeteer|playwright)/i

/** Coarse robot filter: an empty or tool-like user agent is never counted as a shopper. */
export function isLikelyBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 10) return true
  return BOT_PATTERN.test(ua)
}

/**
 * What the server stores for a validated browser event. `userId` and `anonymousId` are deliberately absent (D4:
 * aggregated measurement); the browser clock is only a hint, clamped by `buildEventRow`.
 */
export function toServerEventInput(e: ClientEvent): ServerEventInput {
  return {
    eventId: e.eventId,
    name: e.name,
    occurredAt: typeof e.clientTs === "number" ? e.clientTs : null,
    userId: null,
    anonymousId: null,
    sessionId: e.sessionId ?? null,
    productId: e.productId ?? null,
    listingId: e.listingId ?? null,
    durationMs: e.durationMs ?? null,
    properties: e.properties ?? null,
  }
}

/** The session ids of a batch (one tab normally sends one) — used to rate-limit per session, never stored apart. */
export function sessionIdsOf(events: readonly ClientEvent[]): string[] {
  return [...new Set(events.map((e) => e.sessionId).filter((s): s is string => typeof s === "string"))]
}
