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

import type { OrderConfirmationEmailCopy } from "@/lib/emails/load-email-copy"

export interface OrderConfirmationEmailProps {
  orderId: string
  productName: string
  productImageUrl: string
  quantity: number
  total: string
  currency: string
  customerName: string
  orderUrl: string
  trackingUrl?: string
  copy: OrderConfirmationEmailCopy
}

export const OrderConfirmationEmail = ({
  productName,
  productImageUrl,
  quantity,
  total,
  currency,
  orderUrl,
  trackingUrl,
  copy,
}: OrderConfirmationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>

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
              <Text style={qtyStyle}>{copy.total}</Text>
            </Column>
          </Row>

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button href={orderUrl} style={buttonStyle}>
              {copy.ctaOrder}
            </Button>
            {trackingUrl ? (
              <Text style={{ fontSize: "12px", color: "#666", marginTop: "12px" }}>
                <Link href={trackingUrl} style={{ color: "#5469d4" }}>
                  {copy.ctaTracking}
                </Link>
              </Text>
            ) : null}
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
const hr = { borderColor: "#e6ebf1", margin: "20px 40px" }
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "16px", padding: "0 40px" }
const productNameStyle = {
  fontSize: "16px",
  fontWeight: "600",
  margin: "0 0 4px",
  color: "#111",
}
const qtyStyle = { fontSize: "14px", color: "#666", margin: "0" }
const buttonStyle = {
  backgroundColor: "#5469d4",
  color: "#fff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
  fontWeight: "600",
}

OrderConfirmationEmail.PreviewProps = {
  orderId: "clpreview00000001",
  productName: "Casque Bluetooth Pro",
  productImageUrl: "https://via.placeholder.com/64",
  quantity: 1,
  total: "49.99",
  currency: "EUR",
  customerName: "Marie",
  orderUrl: "https://affisell-market.vercel.app/orders/clpreview00000001",
  copy: {
    preview: "Commande Affisell #000001 confirmée",
    heading: "Merci pour votre commande",
    quantity: "Quantité : 1",
    total: "Total : 49.99 EUR",
    ctaOrder: "Voir ma commande",
    ctaTracking: "Suivre mon colis",
    footer: "Une question ? Répondez à cet e-mail ou consultez votre compte.",
  },
} satisfies OrderConfirmationEmailProps

export default OrderConfirmationEmail
