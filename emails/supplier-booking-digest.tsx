import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components"

import type { SupplierBookingDigestCopy } from "@/lib/emails/supplier-booking-alert-copy"

export type SupplierBookingDigestRow = {
  productName: string
  startsAtLabel: string
  seatLabels: string[]
  quantity: number
  buyerMasked: string
}

export type SupplierBookingDigestEmailProps = {
  dateLabel: string
  rows: SupplierBookingDigestRow[]
  rosterUrl: string
  copy: SupplierBookingDigestCopy
}

export function SupplierBookingDigestEmail({
  dateLabel,
  rows,
  rosterUrl,
  copy,
}: SupplierBookingDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>◷ Affisell Merchant</Text>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.intro}</Text>
          <Text style={date}>{dateLabel}</Text>
          {rows.map((row, i) => (
            <Section key={i} style={rowBox}>
              <Text style={rowTitle}>{row.productName}</Text>
              <Text style={rowMeta}>{row.startsAtLabel}</Text>
              <Text style={rowMeta}>
                {copy.guestLabel}: {row.buyerMasked} · {copy.seatsLabel}:{" "}
                {row.seatLabels.length > 0 ? row.seatLabels.join(", ") : `×${row.quantity}`}
              </Text>
            </Section>
          ))}
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={rosterUrl} style={button}>
              {copy.cta}
            </Button>
          </Section>
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#0f172a", fontFamily: "system-ui, sans-serif" }
const container = { margin: "0 auto", padding: "32px 20px", maxWidth: "520px" }
const badge = { color: "#67e8f9", fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const }
const h1 = { color: "#f8fafc", fontSize: "24px", fontWeight: 700, margin: "12px 0" }
const text = { color: "#cbd5e1", fontSize: "15px", lineHeight: "24px" }
const date = { color: "#a5f3fc", fontSize: "14px", fontWeight: 600, margin: "12px 0 20px" }
const rowBox = { backgroundColor: "#1e293b", borderRadius: "10px", padding: "12px 14px", marginBottom: "10px" }
const rowTitle = { color: "#f1f5f9", fontSize: "15px", fontWeight: 600, margin: "0 0 4px" }
const rowMeta = { color: "#94a3b8", fontSize: "13px", margin: "2px 0" }
const button = { backgroundColor: "#0891b2", color: "#fff", padding: "12px 24px", borderRadius: "8px", fontWeight: 600 }
const footer = { color: "#64748b", fontSize: "12px", lineHeight: "20px" }
