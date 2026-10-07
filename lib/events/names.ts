/**
 * Event registry — the single list of events the spine accepts, and the CLASS each one belongs to.
 *
 *   behavioral     analytics: what a visitor looked at / did before buying. Recorded ONLY with the visitor's analytics
 *                  consent. May carry a visitor identifier (anonymousId / sessionId) and an acquisition channel.
 *   transactional  the business journal: what happened to an order / a listing / a review. It exists whatever the
 *                  visitor's cookie choices are, and never carries a visitor identifier or a marketing channel
 *                  (the database refuses it: see the CHECK constraints of the `event_spine` migration).
 *
 * Do not mix the two: a business fact is not "tracking", and tracking is not a business record.
 *
 * Client-safe (no Prisma, no server-only).
 */

export const EVENT_CLASSES = ["behavioral", "transactional"] as const
export type EventClass = (typeof EVENT_CLASSES)[number]

export type EventDefinition = {
  class: EventClass
  /** May a browser send it to the ingestion endpoint? Business facts are server-side only: a browser is not a witness of a refund. */
  clientEmittable: boolean
  /** Written by the carousel / Pulse / agent checkout before the spine existed (the 7 existing readers rely on these names). */
  legacy?: true
  description: string
}

export const EVENT_REGISTRY = {
  // ── Behavioral ────────────────────────────────────────────────────────────────────────────────────────────────
  product_impression: { class: "behavioral", clientEmittable: true, description: "A listing card was actually seen (visible threshold), with its position." },
  product_click: { class: "behavioral", clientEmittable: true, description: "A listing card was clicked (search clicks are product_click carrying search_id and position)." },
  product_view: { class: "behavioral", clientEmittable: true, description: "A product page was opened." },
  search: { class: "behavioral", clientEmittable: true, description: "A validated search (not a typeahead keystroke), with its result_count; zero results is result_count = 0." },
  attribution_touch: { class: "behavioral", clientEmittable: true, description: "A landing carrying acquisition information (UTM, creator link, external referrer host)." },
  add_to_cart: { class: "behavioral", clientEmittable: true, legacy: true, description: "An item was added to the cart (guest or signed-in)." },
  remove_from_cart: { class: "behavioral", clientEmittable: true, description: "An item was removed from the cart." },
  // Ambiguous class — flagged for the owner: a buyer's step before payment (behavioral, consent-bound) rather than a business fact.
  checkout_started: { class: "behavioral", clientEmittable: false, description: "A Stripe Checkout session was created for a visitor." },
  // Ambiguous class — flagged for the owner: a creator's own marketing activity (behavioral, consent-bound) rather than a business fact.
  creator_share: { class: "behavioral", clientEmittable: false, description: "A creator generated a share link for a product." },
  // Legacy names (carousel / Pulse / agent checkout). Behavioral by nature.
  view: { class: "behavioral", clientEmittable: true, legacy: true, description: "LEGACY: carousel / Pulse impression. Read as such by the existing readers." },
  hover: { class: "behavioral", clientEmittable: true, legacy: true, description: "LEGACY: a card was hovered for 2 s or more." },
  checkout_initiated: { class: "behavioral", clientEmittable: false, legacy: true, description: "LEGACY: agent checkout session created." },

  // ── Transactional (business journal) ──────────────────────────────────────────────────────────────────────────
  purchase: { class: "transactional", clientEmittable: false, description: "An order was paid (one event per order)." },
  refund: { class: "transactional", clientEmittable: false, description: "A Stripe refund was recorded against an order." },
  return_requested: { class: "transactional", clientEmittable: false, description: "A buyer opened a return." },
  return_resolved: { class: "transactional", clientEmittable: false, description: "A return reached a final state (refunded / rejected)." },
  review_created: { class: "transactional", clientEmittable: false, description: "A review was published." },
  delivery: { class: "transactional", clientEmittable: false, description: "An order was delivered." },
  creator_product_added: { class: "transactional", clientEmittable: false, description: "A creator listed a product in their store." },
  creator_product_removed: { class: "transactional", clientEmittable: false, description: "A creator removed a listing from their store." },
} as const satisfies Record<string, EventDefinition>

export type EventName = keyof typeof EVENT_REGISTRY

const NAMES = Object.keys(EVENT_REGISTRY) as EventName[]

export const BEHAVIORAL_EVENT_NAMES: readonly EventName[] = NAMES.filter((n) => EVENT_REGISTRY[n].class === "behavioral")
export const TRANSACTIONAL_EVENT_NAMES: readonly EventName[] = NAMES.filter((n) => EVENT_REGISTRY[n].class === "transactional")
export const CLIENT_EMITTABLE_EVENT_NAMES = NAMES.filter((n) => EVENT_REGISTRY[n].clientEmittable) as [EventName, ...EventName[]]

export function isEventName(name: unknown): name is EventName {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(EVENT_REGISTRY, name)
}

export function eventClassOf(name: unknown): EventClass | null {
  return isEventName(name) ? EVENT_REGISTRY[name].class : null
}
