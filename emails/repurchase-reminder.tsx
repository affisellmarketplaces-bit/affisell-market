import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
  Section,
  Row,
} from "@react-email/components"

import type { RepurchaseReminderEmailCopy } from "@/lib/emails/load-email-copy"

export type RepurchaseReminderEmailProps = {
  productName: string
  productImageUrl: string
  repurchaseUrl: string
  copy: RepurchaseReminderEmailCopy
}

export function RepurchaseReminderEmail({
  productName,
  productImageUrl,
  repurchaseUrl,
  copy,
}: RepurchaseReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={greeting}>{copy.greeting}</Text>
          <Text style={bodyText}>{copy.body}</Text>

          <Row style={productRow}>
            <Column style={{ width: "80px" }}>
              <Img
                src={productImageUrl}
                width="64"
                height="64"
                alt={productName}
                style={{ borderRadius: "8px", objectFit: "cover" }}
              />
            </Column>
            <Column style={{ paddingLeft: "16px" }}>
              <Text style={productNameStyle}>{productName}</Text>
            </Column>
          </Row>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Text style={{ fontWeight: "600", margin: "0 0 16px" }}>{copy.ctaTitle}</Text>
            <Button href={repurchaseUrl} style={button}>
              {copy.ctaRepurchase}
            </Button>
          </Section>

          <Text style={footerNote}>{copy.footerNote}</Text>
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "Inter, system-ui, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "24px auto",
  padding: "24px",
  borderRadius: "12px",
  maxWidth: "520px",
}
const h1 = { color: "#18181b", fontSize: "22px", fontWeight: 700 as const, margin: "0 0 16px" }
const greeting = { color: "#3f3f46", fontSize: "15px", lineHeight: "24px", margin: "0 0 8px" }
const bodyText = { color: "#3f3f46", fontSize: "15px", lineHeight: "24px" }
const productRow = {
  margin: "24px 0",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px",
}
const productNameStyle = { fontWeight: 600 as const, margin: 0, color: "#18181b", fontSize: "15px" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#fff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "600" as const,
}
const footerNote = { color: "#71717a", fontSize: "13px", lineHeight: "20px", marginTop: "16px" }
const footer = { color: "#a1a1aa", fontSize: "12px", lineHeight: "18px", marginTop: "8px" }

export default RepurchaseReminderEmail
