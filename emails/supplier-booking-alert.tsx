import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import type { SupplierBookingAlertCopy } from "@/lib/emails/supplier-booking-alert-copy"

export type SupplierBookingAlertEmailProps = {
  productName: string
  startsAtLabel: string
  venueLabel: string | null
  seatLabels: string[]
  quantity: number
  buyerMasked: string
  rosterUrl: string
  copy: SupplierBookingAlertCopy
}

export function SupplierBookingAlertEmail({
  productName,
  startsAtLabel,
  venueLabel,
  seatLabels,
  quantity,
  buyerMasked,
  rosterUrl,
  copy,
}: SupplierBookingAlertEmailProps) {
  const seatsText =
    seatLabels.length > 0 ? seatLabels.join(", ") : quantity > 1 ? `×${quantity}` : "1"

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>◷ Affisell Merchant</Text>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.intro}</Text>
          <Text style={product}>{productName}</Text>
          <Section style={box}>
            <Text style={label}>{copy.whenLabel}</Text>
            <Text style={value}>{startsAtLabel}</Text>
            {venueLabel ? (
              <>
                <Text style={label}>Lieu</Text>
                <Text style={value}>{venueLabel}</Text>
              </>
            ) : null}
            <Text style={label}>{copy.seatsLabel}</Text>
            <Text style={value}>{seatsText}</Text>
            <Text style={label}>{copy.buyerLabel}</Text>
            <Text style={value}>{buyerMasked}</Text>
          </Section>
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
const product = { color: "#e2e8f0", fontSize: "16px", fontWeight: 600, margin: "16px 0" }
const box = { backgroundColor: "#1e293b", borderRadius: "12px", padding: "16px", margin: "20px 0" }
const label = { color: "#94a3b8", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, margin: "8px 0 4px" }
const value = { color: "#f1f5f9", fontSize: "15px", margin: "0 0 8px" }
const button = { backgroundColor: "#0891b2", color: "#fff", padding: "12px 24px", borderRadius: "8px", fontWeight: 600 }
const footer = { color: "#64748b", fontSize: "12px", lineHeight: "20px" }
