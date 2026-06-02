import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export interface AbandonedCheckoutEmailProps {
  customerName: string
  productName: string
  productImageUrl?: string
  productUrl: string
  priceLabel: string
}

export const AbandonedCheckoutEmail = ({
  customerName,
  productName,
  productImageUrl,
  productUrl,
  priceLabel,
}: AbandonedCheckoutEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Votre sélection Affisell vous attend — {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Votre panier vous attend</Heading>
          <Text style={text}>Bonjour {customerName},</Text>
          <Text style={text}>
            Vous aviez commencé un achat sur Affisell. Votre sélection est toujours disponible — paiement
            sécurisé Stripe, livraison suivie.
          </Text>

          <Section style={card}>
            {productImageUrl ? (
              <Img src={productImageUrl} alt={productName} width="120" height="120" style={image} />
            ) : null}
            <Text style={productTitle}>{productName}</Text>
            <Text style={price}>{priceLabel}</Text>
          </Section>

          <Button href={productUrl} style={button}>
            Reprendre mon achat
          </Button>

          <Text style={footer}>
            Une question ? Consultez la{" "}
            <Link href={`${productUrl.split("/marketplace")[0]}/faq`} style={link}>
              FAQ
            </Link>{" "}
            ou{" "}
            <Link href={`${productUrl.split("/marketplace")[0]}/support`} style={link}>
              l&apos;assistant support
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

AbandonedCheckoutEmail.PreviewProps = {
  customerName: "Alex",
  productName: "Montre connectée Pro X",
  productImageUrl: "https://placehold.co/120x120",
  productUrl: "https://affisell.com/marketplace/abc123",
  priceLabel: "89,00 €",
} satisfies AbandonedCheckoutEmailProps

export default AbandonedCheckoutEmail

const main = { backgroundColor: "#0a0a0a", fontFamily: "system-ui, sans-serif" }
const container = { margin: "0 auto", padding: "32px 16px", maxWidth: "520px" }
const h1 = { color: "#fafafa", fontSize: "22px", fontWeight: "700", margin: "0 0 16px" }
const text = { color: "#d4d4d8", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" }
const card = {
  backgroundColor: "#18181b",
  borderRadius: "12px",
  border: "1px solid #3f3f46",
  padding: "20px",
  margin: "0 0 24px",
  textAlign: "center" as const,
}
const image = { borderRadius: "8px", margin: "0 auto 12px", objectFit: "cover" as const }
const productTitle = { color: "#fafafa", fontSize: "16px", fontWeight: "600", margin: "0 0 4px" }
const price = { color: "#a78bfa", fontSize: "18px", fontWeight: "700", margin: "0" }
const button = {
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  color: "#18181b",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "700",
  padding: "12px 28px",
  textDecoration: "none",
}
const link = { color: "#a78bfa", textDecoration: "underline" }
const footer = { color: "#71717a", fontSize: "13px", lineHeight: "20px", margin: "24px 0 0" }
