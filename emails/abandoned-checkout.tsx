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

import type { AbandonedCheckoutEmailCopy } from "@/lib/emails/load-email-copy"

export interface AbandonedCheckoutEmailProps {
  productName: string
  productImageUrl?: string
  productUrl: string
  priceLabel: string
  faqUrl: string
  supportUrl: string
  copy: AbandonedCheckoutEmailCopy
}

export const AbandonedCheckoutEmail = ({
  productName,
  productImageUrl,
  productUrl,
  priceLabel,
  faqUrl,
  supportUrl,
  copy,
}: AbandonedCheckoutEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.greeting}</Text>
          <Text style={text}>{copy.body}</Text>

          <Section style={card}>
            {productImageUrl ? (
              <Img src={productImageUrl} alt={productName} width="120" height="120" style={image} />
            ) : null}
            <Text style={productTitle}>{productName}</Text>
            <Text style={price}>{priceLabel}</Text>
          </Section>

          <Button href={productUrl} style={button}>
            {copy.cta}
          </Button>

          <Text style={footer}>{copy.footer}</Text>
          <Text style={footerLinks}>
            <Link href={faqUrl} style={linkStyle}>
              FAQ
            </Link>
            {" · "}
            <Link href={supportUrl} style={linkStyle}>
              Support
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

AbandonedCheckoutEmail.PreviewProps = {
  productName: "Montre connectée Pro X",
  productImageUrl: "https://placehold.co/120x120",
  productUrl: "https://affisell.com/marketplace/abc123",
  priceLabel: "89,00 €",
  faqUrl: "https://affisell.com/faq",
  supportUrl: "https://affisell.com/support",
  copy: {
    preview: "Votre sélection Affisell vous attend — Montre connectée Pro X",
    heading: "Votre panier vous attend",
    greeting: "Bonjour Alex,",
    body: "Vous aviez commencé un achat sur Affisell. Votre sélection est toujours disponible — paiement sécurisé Stripe, livraison suivie.",
    cta: "Reprendre mon achat",
    footer: "Une question ? Consultez la FAQ ou l'assistant support sur Affisell.",
  },
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
const footer = { color: "#71717a", fontSize: "13px", lineHeight: "20px", margin: "24px 0 0" }
const footerLinks = { color: "#71717a", fontSize: "12px", lineHeight: "20px", margin: "8px 0 0" }
const linkStyle = { color: "#a78bfa", textDecoration: "underline" }
