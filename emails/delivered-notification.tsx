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
  Row,
} from "@react-email/components"

import type { DeliveredNotificationEmailCopy } from "@/lib/emails/load-email-copy"

export interface DeliveredNotificationEmailProps {
  orderId: string
  productName: string
  productImageUrl: string
  orderUrl: string
  reviewUrl: string
  repurchaseUrl: string
  copy: DeliveredNotificationEmailCopy
}

export const DeliveredNotificationEmail = ({
  productName,
  productImageUrl,
  orderUrl,
  reviewUrl,
  repurchaseUrl,
  copy,
}: DeliveredNotificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={greeting}>{copy.greeting}</Text>

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
              <Text style={qtyStyle}>{copy.quantity}</Text>
            </Column>
          </Row>

          <Section
            style={{
              backgroundColor: "#f0fdf4",
              padding: "16px",
              borderRadius: "8px",
              margin: "24px 0",
              textAlign: "center",
            }}
          >
            <Text style={{ fontWeight: "600", margin: "0 0 12px", fontSize: "16px" }}>
              {copy.reviewTitle}
            </Text>
            <Text style={{ margin: "0 0 16px", color: "#666", fontSize: "14px" }}>{copy.reviewBody}</Text>
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

          <Section style={{ textAlign: "center", marginTop: "24px" }}>
            <Button
              href={repurchaseUrl}
              style={{
                backgroundColor: "#5469d4",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "600",
                marginRight: "12px",
              }}
            >
              {copy.ctaRepurchase}
            </Button>
            <Button
              href={orderUrl}
              style={{
                backgroundColor: "#fff",
                color: "#5469d4",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "600",
                border: "1px solid #5469d4",
              }}
            >
              {copy.ctaOrder}
            </Button>
          </Section>

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
const greeting = { color: "#333", fontSize: "14px", lineHeight: "24px", padding: "0 40px", margin: "0 0 8px" }
const hr = { borderColor: "#e6ebf1", margin: "20px 40px" }
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "16px", padding: "0 40px" }
const productNameStyle = {
  fontSize: "16px",
  fontWeight: "600",
  margin: "0 0 4px",
  color: "#111",
}
const qtyStyle = { fontSize: "14px", color: "#666", margin: "0" }

DeliveredNotificationEmail.PreviewProps = {
  orderId: "clpreview00000003",
  productName: "Casque Bluetooth Pro",
  productImageUrl: "https://via.placeholder.com/64",
  orderUrl: "https://affisell-market.vercel.app/marketplace/account/orders",
  reviewUrl:
    "https://affisell-market.vercel.app/marketplace/clpreview00000003?writeReview=true&orderId=clpreview00000003",
  repurchaseUrl: "https://affisell-market.vercel.app/marketplace/clpreview00000003?ref=repurchase",
  copy: {
    preview: "Votre commande #000003 a été livrée",
    heading: "Colis livré !",
    greeting: "Bonjour Marie, votre commande est arrivée.",
    quantity: "Quantité : 1",
    reviewTitle: "Votre avis compte",
    reviewBody: "Satisfait de votre achat ? Partagez votre expérience en 30 secondes.",
    ctaReview: "Laisser un avis",
    ctaRepurchase: "Racheter",
    ctaOrder: "Voir ma commande",
    footer: "Affisell — affisell-market.vercel.app",
  },
} satisfies DeliveredNotificationEmailProps

export default DeliveredNotificationEmail
