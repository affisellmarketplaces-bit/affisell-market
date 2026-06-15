import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export type CheckoutCountryLaunchEmailProps = {
  countryName: string
  shopUrl: string
  locale: "fr" | "en"
}

export function CheckoutCountryLaunchEmail({
  countryName,
  shopUrl,
  locale,
}: CheckoutCountryLaunchEmailProps) {
  const copy =
    locale === "en"
      ? {
          preview: `Checkout is live in ${countryName}`,
          heading: `Affisell is live in ${countryName}`,
          body: "You asked to be notified — checkout to your country is now open. Browse the catalog and complete your purchase in a few clicks.",
          cta: "Shop now",
          footer: "Secure Stripe checkout · local tax calculated at payment",
        }
      : {
          preview: `Checkout ouvert en ${countryName}`,
          heading: `Affisell est disponible en ${countryName}`,
          body: "Vous aviez demandé à être prévenu — le checkout vers votre pays est ouvert. Parcourez le catalogue et finalisez votre achat en quelques clics.",
          cta: "Acheter maintenant",
          footer: "Paiement Stripe sécurisé · taxes calculées au checkout",
        }

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>🌍 Affisell</Text>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.body}</Text>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={shopUrl} style={button}>
              {copy.cta}
            </Button>
          </Section>
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
}
const badge = { fontSize: "12px", fontWeight: 700, color: "#7c3aed", margin: "0 0 12px" }
const h1 = { fontSize: "24px", fontWeight: 700, color: "#18181b", margin: "0 0 16px" }
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 16px" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
}
const footer = { fontSize: "12px", color: "#71717a", margin: "24px 0 0" }

export default CheckoutCountryLaunchEmail
