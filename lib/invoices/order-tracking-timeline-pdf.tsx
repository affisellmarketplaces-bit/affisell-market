import React from "react"
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import type { AdminOrderTrackingAudit } from "@/lib/admin/orders/types"
import {
  formatTrackingAuditTimestamp,
  trackingAuditDeliveredAtSourceLabel,
  trackingAuditEventLabel,
  trackingAuditSourceLabel,
} from "@/lib/admin/orders/tracking-audit-labels.shared"
import { readAffisellLegalEntity } from "@/lib/legal/company-env"

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  title: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#444", marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: "38%", color: "#555" },
  value: { width: "62%" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginTop: 6,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  colTime: { width: "22%" },
  colEvent: { width: "18%" },
  colSource: { width: "22%" },
  colTracking: { width: "38%" },
  empty: { marginTop: 8, color: "#666", fontStyle: "italic" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#666",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 6,
  },
  notice: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 8,
    color: "#444",
  },
})

function field(label: string, value: string) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

function TrackingAuditDocument({ audit }: { audit: AdminOrderTrackingAudit }) {
  const legal = readAffisellLegalEntity()
  const generatedLabel = formatTrackingAuditTimestamp(audit.generatedAt)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Rapport de traçabilité colis</Text>
        <Text style={styles.subtitle}>
          {legal.companyName} · Commande {audit.orderId} · généré le {generatedLabel} UTC
        </Text>

        <Text style={styles.sectionTitle}>Commande</Text>
        {field("Produit", audit.productName + (audit.variantLabel ? ` · ${audit.variantLabel}` : ""))}
        {field("Client", audit.customerEmail)}
        {field("Fournisseur", audit.supplierName)}
        {audit.affiliateName ? field("Affilié", audit.affiliateName) : null}
        {field("Statut", `${audit.status} / ${audit.fulfillmentStatus}`)}

        <Text style={styles.sectionTitle}>Suivi actuel</Text>
        {field(
          "Transporteur / n°",
          audit.trackingNumber
            ? `${audit.trackingCarrier ?? "—"} · ${audit.trackingNumber}`
            : "—"
        )}
        {field(
          "Verrouillage suivi",
          audit.trackingLocked
            ? `Oui (${audit.trackingVerifiedBy ?? "validé"})`
            : "Non"
        )}
        {field("Expédié le", audit.shippedAt ? formatTrackingAuditTimestamp(audit.shippedAt) : "—")}
        {field(
          "Livré (attestation)",
          audit.deliveredAt
            ? `${formatTrackingAuditTimestamp(audit.deliveredAt)} · ${trackingAuditDeliveredAtSourceLabel(audit.deliveredAtSource)}`
            : "—"
        )}
        {field(
          "Confirmé acheteur",
          audit.deliveryConfirmedAt
            ? `${formatTrackingAuditTimestamp(audit.deliveryConfirmedAt)} (${audit.deliveryConfirmedBy ?? "buyer"})`
            : "—"
        )}

        <Text style={styles.sectionTitle}>Journal d&apos;événements (append-only)</Text>
        {audit.timeline.length === 0 ? (
          <Text style={styles.empty}>Aucun événement enregistré pour cette commande.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={styles.colTime}>Horodatage (UTC)</Text>
              <Text style={styles.colEvent}>Événement</Text>
              <Text style={styles.colSource}>Source</Text>
              <Text style={styles.colTracking}>Suivi / vérification</Text>
            </View>
            {audit.timeline.map((event) => (
              <View key={event.id} style={styles.tableRow}>
                <Text style={styles.colTime}>{formatTrackingAuditTimestamp(event.createdAt)}</Text>
                <Text style={styles.colEvent}>{trackingAuditEventLabel(event.eventType)}</Text>
                <Text style={styles.colSource}>{trackingAuditSourceLabel(event.source)}</Text>
                <Text style={styles.colTracking}>
                  {event.trackingCarrier ?? "—"}
                  {event.trackingNumber ? ` · ${event.trackingNumber}` : ""}
                  {event.verificationMethod ? ` · ${event.verificationMethod}` : ""}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.notice}>
          <Text>
            Document généré automatiquement depuis la base Affisell (OrderTrackingEvent). Les
            horodatages UTC et la source deliveredAt sont utilisables comme preuve en litige
            consommateur (droit de rétractation UE).
          </Text>
        </View>

        <Text style={styles.footer}>
          {legal.companyName} · SIREN {legal.siren} · {legal.address} · ID rapport {audit.orderId}
        </Text>
      </Page>
    </Document>
  )
}

export async function renderOrderTrackingTimelinePdf(
  audit: AdminOrderTrackingAudit
): Promise<Buffer> {
  const buf = await renderToBuffer(<TrackingAuditDocument audit={audit} />)
  return Buffer.from(buf)
}
