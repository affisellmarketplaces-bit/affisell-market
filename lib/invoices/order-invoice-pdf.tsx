import React from "react"
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import { readAffisellLegalEntity } from "@/lib/legal/company-env"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 8, fontWeight: "bold" },
  meta: { marginBottom: 16, color: "#444" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  total: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#ccc" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#666" },
})

type InvoiceType = "SUPPLIER" | "AFFILIATE" | "CUSTOMER"

type OrderInvoiceData = {
  orderId: string
  productName: string
  createdAt: string
  supplierPayoutCents: number
  affiliateEarningCents: number
  totalCents: number
  subtotalCents: number
  taxCents: number
  customerEmail: string
}

function money(cents: number) {
  return formatStoreCurrencyFromCents(cents)
}

function InvoiceDocument({ type, order }: { type: InvoiceType; order: OrderInvoiceData }) {
  const legal = readAffisellLegalEntity()
  const tvaSuffix = legal.tva ? ` · TVA FR${legal.tva}` : ""
  const legalFooter = `${legal.companyName} · SIREN ${legal.siren}${tvaSuffix} · ${legal.address}`

  let title = "Document"
  let lines: { label: string; amount: string }[] = []

  if (type === "SUPPLIER") {
    title = "Facture wholesale — reversement fournisseur"
    lines = [{ label: "Net wholesale (auto-facturation)", amount: money(order.supplierPayoutCents) }]
  } else if (type === "AFFILIATE") {
    title = "Note de commission affilié"
    lines = [{ label: "Gains affilié (commission + markup net)", amount: money(order.affiliateEarningCents) }]
  } else {
    title = "Facture client TTC"
    lines = [
      { label: "Montant HT", amount: money(order.subtotalCents) },
      { label: "TVA (20 %)", amount: money(order.taxCents) },
      { label: "Total TTC", amount: money(order.totalCents) },
    ]
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {legal.companyName} · Commande {order.orderId.slice(0, 12)} · {order.createdAt}
        </Text>
        <Text style={styles.meta}>Produit : {order.productName}</Text>
        {type === "CUSTOMER" ? <Text style={styles.meta}>Client : {order.customerEmail}</Text> : null}

        <View style={{ marginTop: 24 }}>
          {lines.map((line) => (
            <View key={line.label} style={styles.row}>
              <Text>{line.label}</Text>
              <Text>{line.amount}</Text>
            </View>
          ))}
        </View>

        <View style={styles.total}>
          <View style={styles.row}>
            <Text style={{ fontWeight: "bold" }}>Montant dû</Text>
            <Text style={{ fontWeight: "bold" }}>
              {type === "SUPPLIER"
                ? money(order.supplierPayoutCents)
                : type === "AFFILIATE"
                  ? money(order.affiliateEarningCents)
                  : money(order.totalCents)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>{legalFooter}</Text>
      </Page>
    </Document>
  )
}

export async function renderOrderInvoicePdf(type: InvoiceType, order: OrderInvoiceData): Promise<Buffer> {
  const buf = await renderToBuffer(<InvoiceDocument type={type} order={order} />)
  return Buffer.from(buf)
}

export type { InvoiceType, OrderInvoiceData }
