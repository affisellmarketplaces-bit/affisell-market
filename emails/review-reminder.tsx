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

export interface ReviewReminderEmailProps {
  orderId: string
  customerName: string
  productName: string
  productImageUrl: string
  deliveredAt: string
  reviewUrl: string
}

export const ReviewReminderEmail = ({
  orderId,
  customerName,
  productName,
  productImageUrl,
  deliveredAt,
  reviewUrl,
}: ReviewReminderEmailProps) => {
  const shortOrderId = orderId.slice(-6).toUpperCase()

  return (
    <Html>
      <Head />
      <Preview>Un avis sur votre commande #{shortOrderId}?</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Votre avis nous intéresse</Heading>
          <Text style={greeting}>Bonjour {customerName},</Text>
          <Text style={bodyText}>
            Vous avez reçu votre commande le {deliveredAt}. Comment s&apos;est passé votre expérience?
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
            <Text style={{ fontWeight: "600", margin: "0 0 16px" }}>
              Notez votre achat en 30 secondes
            </Text>
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
              Laisser un avis
            </Button>
          </Section>

          <Text style={footerNote}>
            Vous recevez ce mail une seule fois. Merci de faire grandir Affisell.
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

ReviewReminderEmail.PreviewProps = {
  orderId: "clpreview00000005",
  customerName: "Marie",
  productName: "Casque Bluetooth Pro",
  productImageUrl: "https://via.placeholder.com/64",
  deliveredAt: "12 mai 2026",
  reviewUrl:
    "https://affisell-market.vercel.app/marketplace/clpreview00000005?writeReview=true&orderId=clpreview00000005",
} satisfies ReviewReminderEmailProps

export default ReviewReminderEmail
