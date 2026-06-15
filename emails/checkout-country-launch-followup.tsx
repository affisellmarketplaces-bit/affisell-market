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

export type CheckoutCountryLaunchFollowupEmailProps = {
  countryName: string
  shopUrl: string
  locale: "fr" | "en"
}

export function CheckoutCountryLaunchFollowupEmail({
  countryName,
  shopUrl,
  locale,
}: CheckoutCountryLaunchFollowupEmailProps) {
  const copy =
    locale === "en"
      ? {
          preview: `Still shopping from ${countryName}?`,
          heading: `Checkout to ${countryName} is live`,
          body: "We opened checkout to your country a few days ago. Your cart is one click away — secure Stripe payment and shipping to your address.",
          cta: "Complete my purchase",
          footer: "You joined the launch waitlist — reply if you need help.",
        }
      : {
          preview: `Toujours intéressé pour ${countryName} ?`,
          heading: `Le checkout vers ${countryName} est ouvert`,
          body: "Nous avons ouvert le checkout vers votre pays il y a quelques jours. Finalisez votre achat en quelques clics — paiement Stripe sécurisé et livraison à votre adresse.",
          cta: "Finaliser mon achat",
          footer: "Vous étiez sur la liste d'attente — répondez à cet email si besoin.",
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

export default CheckoutCountryLaunchFollowupEmail
