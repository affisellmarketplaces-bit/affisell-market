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

import type { AffiliateNewSaleAlertCopy } from "@/lib/emails/merchant-order-alert-copy"

export type AffiliateNewSaleAlertEmailProps = {
  productName: string
  variantLabel: string | null
  quantity: number
  earningsLabel: string
  orderRef: string
  earningsUrl: string
  copy: AffiliateNewSaleAlertCopy
}

export function AffiliateNewSaleAlertEmail({
  productName,
  variantLabel,
  quantity,
  earningsLabel,
  orderRef,
  earningsUrl,
  copy,
}: AffiliateNewSaleAlertEmailProps) {
  const productLine = variantLabel?.trim() ? `${productName} · ${variantLabel.trim()}` : productName

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>✦ Affisell Partner</Text>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.intro}</Text>
          <Text style={product}>{productLine}</Text>
          <Section style={box}>
            <Text style={label}>{copy.orderLabel}</Text>
            <Text style={value}>#{orderRef}</Text>
            <Text style={label}>{copy.qtyLabel}</Text>
            <Text style={value}>×{quantity}</Text>
            <Text style={label}>{copy.earningsLabel}</Text>
            <Text style={valueHighlight}>{earningsLabel}</Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={earningsUrl} style={button}>
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
const badge = {
  color: "#c4b5fd",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
}
const h1 = { color: "#f8fafc", fontSize: "24px", fontWeight: 700, margin: "12px 0" }
const text = { color: "#cbd5e1", fontSize: "15px", lineHeight: "24px" }
const product = { color: "#e2e8f0", fontSize: "16px", fontWeight: 600, margin: "16px 0" }
const box = {
  backgroundColor: "#1e293b",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "20px 0",
}
const label = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  margin: "12px 0 4px",
}
const value = { color: "#f1f5f9", fontSize: "15px", margin: "0 0 4px" }
const valueHighlight = { color: "#a7f3d0", fontSize: "18px", fontWeight: 700, margin: "0 0 4px" }
const button = {
  backgroundColor: "#7c3aed",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 700,
  padding: "12px 24px",
  textDecoration: "none",
}
const footer = { color: "#64748b", fontSize: "12px", lineHeight: "20px", marginTop: "24px" }
