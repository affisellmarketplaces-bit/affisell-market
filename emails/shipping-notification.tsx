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

import type { ShippingNotificationEmailCopy } from "@/lib/emails/load-email-copy"

export interface ShippingNotificationEmailProps {
  orderId: string
  productName: string
  productImageUrl: string
  trackingUrl: string
  trackingNumber: string
  carrier: string
  orderUrl: string
  copy: ShippingNotificationEmailCopy
}

export const ShippingNotificationEmail = ({
  productName,
  productImageUrl,
  trackingUrl,
  orderUrl,
  copy,
}: ShippingNotificationEmailProps) => {
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
            </Column>
          </Row>

          <Section
            style={{
              backgroundColor: "#f0fdf4",
              padding: "16px",
              borderRadius: "8px",
              margin: "24px 0",
            }}
          >
            <Text style={{ fontWeight: "600", margin: "0 0 8px" }}>{copy.trackingNumber}</Text>
            <Text style={{ margin: "0 0 16px", color: "#666" }}>{copy.carrier}</Text>
            <Button
              href={trackingUrl}
              style={{
                backgroundColor: "#16a34a",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              {copy.ctaTrack}
            </Button>
          </Section>

          <Section style={{ textAlign: "center", marginTop: "32px" }}>
            <Button href={orderUrl} style={buttonStyle}>
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

ShippingNotificationEmail.PreviewProps = {
  orderId: "clpreview00000002",
  productName: "Casque Bluetooth Pro",
  productImageUrl: "https://via.placeholder.com/64",
  trackingUrl: "https://www.colissimo.fr/portail_colissimo/suivre-un-colis",
  trackingNumber: "8Q12345678901",
  carrier: "Colissimo",
  orderUrl: "https://affisell-market.vercel.app/orders/clpreview00000002",
  copy: {
    preview: "Votre commande #000002 est en route",
    heading: "Bonne nouvelle, votre colis est parti !",
    quantity: "Quantité : 1",
    trackingNumber: "Numéro de suivi : 8Q12345678901",
    carrier: "Transporteur : Colissimo",
    ctaTrack: "Suivre mon colis",
    ctaOrder: "Voir ma commande",
    footer: "Affisell — affisell-market.vercel.app",
  },
} satisfies ShippingNotificationEmailProps

export default ShippingNotificationEmail
