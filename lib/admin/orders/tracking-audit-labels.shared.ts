import type { OrderTrackingEventSource, OrderTrackingEventType } from "@/lib/order-tracking-event"

const EVENT_LABELS: Record<OrderTrackingEventType, string> = {
  TRACKING_REGISTERED: "Suivi enregistré",
  IN_TRANSIT: "En transit",
  DELIVERED: "Livré (transporteur)",
  TRACKING_UPDATED: "Suivi mis à jour",
}

const SOURCE_LABELS: Record<OrderTrackingEventSource, string> = {
  supplier_mark_shipped: "Fournisseur (dashboard)",
  aftership_webhook: "Webhook AfterShip",
  supplier_fulfillment_webhook: "Webhook partenaire",
  supplier_sync: "Sync partenaire (cron)",
  autods: "AutoDS",
}

const DELIVERED_AT_SOURCE_LABELS: Record<string, string> = {
  aftership_webhook: "AfterShip (transporteur)",
  digital_instant: "Livraison digitale instantanée",
  booking_confirmed: "Réservation confirmée",
  legacy: "Historique (pré-audit)",
}

export function trackingAuditEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType as OrderTrackingEventType] ?? eventType
}

export function trackingAuditSourceLabel(source: string): string {
  return SOURCE_LABELS[source as OrderTrackingEventSource] ?? source
}

export function trackingAuditDeliveredAtSourceLabel(source: string | null | undefined): string {
  if (!source) return "—"
  return DELIVERED_AT_SOURCE_LABELS[source] ?? source
}

export function formatTrackingAuditTimestamp(iso: string, locale = "fr-FR"): string {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  })
}
