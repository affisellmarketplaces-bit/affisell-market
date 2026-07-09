import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Text,
} from "@react-email/components"

export type OnboardingAffiliateDay3EmailProps = {
  name: string
  dashboardImageUrl: string
  productsUrl: string
}

export function OnboardingAffiliateDay3Email({
  name,
  dashboardImageUrl,
  productsUrl,
}: OnboardingAffiliateDay3EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>523€/mois avec 12 produits — case study Affisell</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            Case study : Lucas M., affilié depuis 4 mois, génère <strong>523€/mois</strong> avec{" "}
            <strong>12 produits</strong> listés depuis Pulse.
          </Text>
          <Text style={text}>
            Sa recette : 3 niches testées en semaine 1, marge moyenne 180%, partage lien boutique +
            2 posts TikTok/semaine. Payout Stripe J+7 à chaque cycle.
          </Text>
          <Img
            src={dashboardImageUrl}
            alt="Dashboard affilié Affisell — ventes et commissions"
            width="472"
            style={screenshot}
          />
          <Button href={productsUrl} style={button}>
            Voir ses produits
          </Button>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingAffiliateDay3Email.PreviewProps = {
  name: "Alex",
  dashboardImageUrl: "https://affisell.com/illustrations/dashboard-preview.svg",
  productsUrl: "https://affisell.com/shops/browse",
} satisfies OnboardingAffiliateDay3EmailProps

export default OnboardingAffiliateDay3Email

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
}
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 12px" }
const muted = { fontSize: "13px", lineHeight: "20px", color: "#71717a", margin: "16px 0 0" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "12px 0 4px",
}
const screenshot = {
  display: "block",
  width: "100%",
  maxWidth: "472px",
  borderRadius: "12px",
  border: "1px solid #e4e4e7",
  margin: "8px 0 12px",
}
