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

export interface PaymentFailedEmailProps {
  orderId: string
  customerName: string
  productName: string
  productImageUrl: string
  updatePaymentUrl: string
}

export const PaymentFailedEmail = ({
  orderId,
  customerName,
  productName,
  productImageUrl,
  updatePaymentUrl,
}: PaymentFailedEmailProps) => {
  const shortOrderId = orderId.slice(-6).toUpperCase()

  return (
    <Html>
      <Head />
      <Preview>Action requise : échec paiement #{shortOrderId}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Action requise</Heading>
          <Text style={greeting}>Bonjour {customerName},</Text>
          <Text style={bodyText}>
            Votre carte a expiré. Mettez à jour en 1 clic pour éviter l&apos;annulation.
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
            </Column>
          </Row>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={updatePaymentUrl}
              style={{
                backgroundColor: "#f59e0b",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              Mettre à jour ma carte
            </Button>
          </Section>

          <Text style={footerNote}>
            Lien sécurisé Stripe — aucune saisie de carte sur Affisell.
          </Text>

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

PaymentFailedEmail.PreviewProps = {
  orderId: "clpreview00000006",
  customerName: "Marie",
  productName: "Casque Bluetooth Pro",
  productImageUrl: "https://via.placeholder.com/64",
  updatePaymentUrl: "https://billing.stripe.com/session/test_portal",
} satisfies PaymentFailedEmailProps

export default PaymentFailedEmail
