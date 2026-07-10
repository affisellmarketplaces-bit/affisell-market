import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components"

export type OnboardingAffiliateDay1EmailProps = {
  name: string
  preheader: string
  pulseUrl: string
}

export function OnboardingAffiliateDay1Email({
  name,
  preheader,
  pulseUrl,
}: OnboardingAffiliateDay1EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preheader}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            <strong>Pulse → Lister → Partager.</strong> C&apos;est tout pour ton 1er €.
          </Text>
          <Text style={listItem}>1. Pulse — choisis 1 produit viral</Text>
          <Text style={listItem}>2. Lister — publie sur ta boutique</Text>
          <Text style={listItem}>3. Partager — envoie ton lien</Text>
          <Text style={text}>Dès ta 1ère vente : payout J+7 sur Stripe.</Text>
          <Button href={pulseUrl} style={button}>
            Ouvrir Pulse maintenant
          </Button>
          <Text style={muted}>Besoin d&apos;aide ? Réponds à cet email.</Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingAffiliateDay1Email.PreviewProps = {
  name: "Alex",
  preheader: "Payout J+7 garanti",
  pulseUrl: "https://affisell.com/dashboard/affiliate/hub?mode=swipe&onboarding=1",
} satisfies OnboardingAffiliateDay1EmailProps

export default OnboardingAffiliateDay1Email

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
}
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 12px" }
const listItem = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 8px", paddingLeft: "4px" }
const muted = { fontSize: "13px", lineHeight: "20px", color: "#71717a", margin: "16px 0 0" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 4px",
}
