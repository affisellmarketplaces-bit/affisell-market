import React from "react"
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import {
  INVOICE_COMMISSIONNAIRE_FOOTER_EN,
  INVOICE_COMMISSIONNAIRE_FOOTER_FR,
} from "@/lib/legal/affiliate-commissionnaire-shared"
import { isAffisellVatFranchise, readCompanyLegal } from "@/lib/legal/company-env"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 8, fontWeight: "bold" },
  meta: { marginBottom: 16, color: "#444" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  total: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#ccc" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#666" },
  legalNote: { marginTop: 16, fontSize: 8, color: "#555", lineHeight: 1.4 },
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
  /** Affilié-Commissionnaire — émet la facture client. */
  commissionnaireSellerName?: string
  commissionnaireSellerLegal?: string
  /** Fournisseur — facture wholesale à l'affilié uniquement. */
  supplierSellerName?: string
  marginAmountCents?: number
  commissionAmountCents?: number
  resalePriceCents?: number
  pricingFreedom?: boolean
  locale?: "fr" | "en"
}

function money(cents: number) {
  return formatStoreCurrencyFromCents(cents)
}

function InvoiceDocument({ type, order }: { type: InvoiceType; order: OrderInvoiceData }) {
  const company = readCompanyLegal()
  const franchise = isAffisellVatFranchise(company)
  const locale = order.locale ?? "fr"
  const commissionnaireFooter =
    locale === "en" ? INVOICE_COMMISSIONNAIRE_FOOTER_EN : INVOICE_COMMISSIONNAIRE_FOOTER_FR

  const vatBit = company.tva.trim()
    ? ` · TVA FR${company.tva.replace(/^FR/i, "")}`
    : company.vatRegime
      ? ` · ${company.vatRegime}`
      : ""

  let title = "Document"
  let lines: { label: string; amount: string }[] = []
  let customerVatNote: string | null = null
  let issuerLine = company.name
  let legalFooter = `${company.name} · SIREN ${company.siren}${vatBit} · ${company.address}`

  if (type === "SUPPLIER") {
    title =
      locale === "en"
        ? "Wholesale invoice — Supplier → Affiliate-Commission Agent"
        : "Facture wholesale — Fournisseur → Affilié-Commissionnaire"
    issuerLine = order.supplierSellerName?.trim() || company.name
    lines = [
      {
        label:
          locale === "en"
            ? "Supplier net wholesale (HT)"
            : "Net wholesale fournisseur (HT)",
        amount: money(order.supplierPayoutCents),
      },
    ]
    legalFooter = `${issuerLine} · ${commissionnaireFooter}`
  } else if (type === "AFFILIATE") {
    title =
      locale === "en"
        ? "Commission statement — Affiliate-Commission Agent"
        : "Relevé commission — Affilié-Commissionnaire"
    lines = [
      {
        label: locale === "en" ? "Platform/supplier commission" : "Commission versée",
        amount: money(order.commissionAmountCents ?? order.affiliateEarningCents),
      },
      {
        label: locale === "en" ? "Free margin (retained)" : "Marge libre (conservée)",
        amount: money(order.marginAmountCents ?? 0),
      },
    ]
  } else {
    title = locale === "en" ? "Customer invoice" : "Facture client"
    issuerLine = order.commissionnaireSellerName?.trim() || company.name
    if (franchise || order.taxCents <= 0) {
      lines = [{ label: locale === "en" ? "Total" : "Total", amount: money(order.totalCents) }]
      customerVatNote = company.vatRegime || "TVA non applicable, art. 293 B du CGI"
    } else {
      lines = [
        { label: locale === "en" ? "Amount excl. VAT" : "Montant HT", amount: money(order.subtotalCents) },
        { label: "TVA", amount: money(order.taxCents) },
        { label: locale === "en" ? "Total incl. VAT" : "Total TTC", amount: money(order.totalCents) },
      ]
    }
    legalFooter = [
      order.commissionnaireSellerLegal?.trim() || issuerLine,
      order.commissionnaireSellerName?.trim() && order.commissionnaireSellerLegal?.trim()
        ? order.commissionnaireSellerName.trim()
        : null,
      commissionnaireFooter,
    ]
      .filter(Boolean)
      .join(" · ")
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {issuerLine} · Commande {order.orderId.slice(0, 12)} · {order.createdAt}
        </Text>
        <Text style={styles.meta}>Produit : {order.productName}</Text>
        {type === "CUSTOMER" ? <Text style={styles.meta}>Client : {order.customerEmail}</Text> : null}
        {type === "CUSTOMER" && order.supplierSellerName ? (
          <Text style={styles.meta}>
            {locale === "en" ? "Delivered by" : "Livré par"} : {order.supplierSellerName}
          </Text>
        ) : null}
        {customerVatNote ? <Text style={styles.meta}>{customerVatNote}</Text> : null}

        <View style={{ marginTop: 24 }}>
          {lines.map((line) => (
            <View key={line.label} style={styles.row}>
              <Text>{line.label}</Text>
              <Text>{line.amount}</Text>
            </View>
          ))}
        </View>

        {type === "CUSTOMER" && order.pricingFreedom ? (
          <Text style={styles.legalNote}>
            {locale === "en"
              ? "Pricing freedom attested — resale HT basis recorded at checkout (anti L134-1 reclassification)."
              : "Liberté de prix attestée — base HT de revente enregistrée au checkout (anti-requalification L134-1)."}
          </Text>
        ) : null}

        <View style={styles.total}>
          <View style={styles.row}>
            <Text style={{ fontWeight: "bold" }}>{locale === "en" ? "Amount due" : "Montant dû"}</Text>
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
