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

export type CheckoutCountryGraduatedEmailProps = {
  countryName: string
  shopUrl: string
  locale: "fr" | "en"
}

export function CheckoutCountryGraduatedEmail({
  countryName,
  shopUrl,
  locale,
}: CheckoutCountryGraduatedEmailProps) {
  const copy =
    locale === "en"
      ? {
          preview: `${countryName} is now a permanent Affisell checkout country`,
          heading: `Checkout is permanent in ${countryName}`,
          body: "Good news — Affisell checkout to your country is now part of our permanent marketplace. Browse the catalog and order with secure Stripe payment and local shipping.",
          cta: "Shop now",
          footer: "You are receiving this because you shopped or signed up from this region.",
        }
      : {
          preview: `${countryName} est désormais un pays checkout permanent sur Affisell`,
          heading: `Checkout permanent en ${countryName}`,
          body: "Bonne nouvelle — le checkout Affisell vers votre pays fait maintenant partie de notre marketplace permanente. Parcourez le catalogue et commandez avec paiement Stripe sécurisé et livraison locale.",
          cta: "Acheter maintenant",
          footer: "Vous recevez cet email car vous avez acheté ou vous êtes inscrit depuis cette région.",
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

export default CheckoutCountryGraduatedEmail

CheckoutCountryGraduatedEmail.PreviewProps = {
  countryName: "Japan",
  shopUrl: "https://affisell.com/marketplace?shipsTo=jp",
  locale: "fr",
} satisfies CheckoutCountryGraduatedEmailProps
