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
  Hr,
  Link,
  Row,
} from "@react-email/components"

import type { ReviewReminderEmailCopy } from "@/lib/emails/load-email-copy"

export interface ReviewReminderEmailProps {
  orderId: string
  productName: string
  productImageUrl: string
  reviewUrl: string
  copy: ReviewReminderEmailCopy
}

export const ReviewReminderEmail = ({
  productName,
  productImageUrl,
  reviewUrl,
  copy,
}: ReviewReminderEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={greeting}>{copy.greeting}</Text>
          <Text style={bodyText}>{copy.body}</Text>

          <Row
            style={{
              margin: "24px 0",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
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
            <Button
              href={reviewUrl}
              style={{
                backgroundColor: "#f59e0b",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              {copy.ctaReview}
            </Button>
          </Section>

          <Text style={footerNote}>{copy.footerNote}</Text>

          <Hr style={hr} />

          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
}
const h1 = { color: "#333", fontSize: "24px", fontWeight: "bold", padding: "0 40px" }
const greeting = { color: "#333", fontSize: "14px", lineHeight: "24px", padding: "0 40px", margin: "0" }
const bodyText = { margin: "16px 0", padding: "0 40px", color: "#333", fontSize: "14px", lineHeight: "24px" }
const hr = { borderColor: "#e6ebf1", margin: "20px 40px" }
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "16px", padding: "0 40px" }
const footerNote = { color: "#666", fontSize: "12px", textAlign: "center" as const, padding: "0 40px" }
const productNameStyle = {
  fontSize: "16px",
  fontWeight: "600",
  margin: "0",
  color: "#111",
}

ReviewReminderEmail.PreviewProps = {
  orderId: "clpreview00000005",
  productName: "Casque Bluetooth Pro",
  productImageUrl: "https://via.placeholder.com/64",
  reviewUrl:
    "https://affisell-market.vercel.app/marketplace/clpreview00000005?writeReview=true&orderId=clpreview00000005",
  copy: {
    preview: "Un avis sur votre commande #000005 ?",
    heading: "Votre avis nous intéresse",
    greeting: "Bonjour Marie,",
    body: "Vous avez reçu votre commande le 12 mai 2026. Comment s'est passé votre expérience ?",
    ctaTitle: "Notez votre achat en 30 secondes",
    ctaReview: "Laisser un avis",
    footerNote: "Vous recevez ce mail une seule fois. Merci de faire grandir Affisell.",
    footer: "Affisell — affisell-market.vercel.app",
  },
} satisfies ReviewReminderEmailProps

export default ReviewReminderEmail
