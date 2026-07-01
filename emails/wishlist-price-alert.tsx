import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components"

export type WishlistPriceAlertEmailProps = {
  customerName: string
  productName: string
  currentPriceLabel: string
  dropPercent: number
  targetPriceLabel?: string | null
  listingUrl: string
}

export function WishlistPriceAlertEmail({
  customerName,
  productName,
  currentPriceLabel,
  dropPercent,
  targetPriceLabel,
  listingUrl,
}: WishlistPriceAlertEmailProps) {
  const pctLine = dropPercent > 0 ? ` (-${dropPercent}% depuis hier)` : ""
  return (
    <Html>
      <Head />
      <Preview>
        {dropPercent > 0
          ? `Baisse de prix : ${productName}`
          : `Prix cible atteint : ${productName}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Alerte prix Affisell</Heading>
          <Text style={text}>Bonjour {customerName},</Text>
          <Text style={text}>
            Le produit <strong>{productName}</strong> a baissé{pctLine}.
          </Text>
          <Text style={text}>
            Prix actuel : <strong>{currentPriceLabel}</strong>
          </Text>
          {targetPriceLabel ? (
            <Text style={text}>
              Votre prix cible : <strong>{targetPriceLabel}</strong>
            </Text>
          ) : null}
          <Button href={listingUrl} style={button}>
            Voir le produit
          </Button>
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
const text = { color: "#3f3f46", fontSize: "15px", lineHeight: "24px" }
const button = {
  backgroundColor: "#7c3aed",
  borderRadius: "8px",
  color: "#fff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600 as const,
  marginTop: "16px",
  padding: "12px 20px",
  textDecoration: "none",
}

export default WishlistPriceAlertEmail
