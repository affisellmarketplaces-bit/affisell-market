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

export interface CancelledNotificationEmailProps {
  orderId: string
  customerName: string
  productName: string
  productImageUrl: string
  quantity: number
  totalAmount: string
  currency: string
  cancelReason?: string
  refundAmount?: string
  orderUrl: string
  supportUrl: string
}

export const CancelledNotificationEmail = ({
  orderId,
  customerName,
  productName,
  productImageUrl,
  quantity,
  currency,
  cancelReason,
  refundAmount,
  orderUrl,
  supportUrl,
}: CancelledNotificationEmailProps) => {
  const shortOrderId = orderId.slice(-6).toUpperCase()
  const refundDisplay = refundAmount ?? "—"

  return (
    <Html>
      <Head />
      <Preview>Votre commande #{shortOrderId} a été annulée</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Commande annulée</Heading>
          <Text style={greeting}>
            Bonjour {customerName}, votre commande #{shortOrderId} a été annulée.
          </Text>

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
              <Text style={qtyStyle}>Quantité: {quantity}</Text>
            </Column>
          </Row>

          <Section
            style={{
              backgroundColor: "#fef2f2",
              padding: "16px",
              borderRadius: "8px",
              margin: "24px 0",
            }}
          >
            <Text style={{ fontWeight: "600", margin: "0 0 8px" }}>
              Montant remboursé : {refundDisplay} {currency}
            </Text>
            <Text style={{ margin: "0", color: "#666", fontSize: "14px" }}>
              Le remboursement apparaît sur votre compte sous 5-10 jours ouvrés.
            </Text>
            {cancelReason ? (
              <Text style={{ margin: "12px 0 0", color: "#666", fontSize: "14px" }}>
                Motif : {cancelReason}
              </Text>
            ) : null}
          </Section>

          <Section style={{ textAlign: "center", marginTop: "24px" }}>
            <Button
              href={supportUrl}
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
              Contacter le support
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
              Voir ma commande
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Affisell -{" "}
            <Link href="https://affisell-market.vercel.app">affisell-market.vercel.app</Link>
          </Text>
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

CancelledNotificationEmail.PreviewProps = {
  orderId: "clpreview00000004",
  customerName: "Marie",
  productName: "Casque Bluetooth Pro",
  productImageUrl: "https://via.placeholder.com/64",
  quantity: 1,
  totalAmount: "49.99",
  currency: "EUR",
  cancelReason: "Rupture de stock fournisseur",
  refundAmount: "49.99",
  orderUrl: "https://affisell-market.vercel.app/marketplace/account/orders",
  supportUrl: "https://affisell-market.vercel.app/contact?order=clpreview00000004",
} satisfies CancelledNotificationEmailProps

export default CancelledNotificationEmail
