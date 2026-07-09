import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components"

export type OnboardingAffiliateDay7EmailProps = {
  name: string
  calendlyUrl: string
}

export function OnboardingAffiliateDay7Email({ name, calendlyUrl }: OnboardingAffiliateDay7EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>15 min pour débloquer ton 1er €</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            Tu bloques ? Réserve <strong>15 min avec moi</strong> — je t&apos;aide à set up ton 1er €
            (Pulse, lien boutique, 1er post).
          </Text>
          <Text style={text}>Créneaux dispos cette semaine :</Text>
          <Button href={calendlyUrl} style={button}>
            Choisir un créneau 📞
          </Button>
          <Text style={muted}>Besoin d&apos;aide ? Réponds à cet email.</Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingAffiliateDay7Email.PreviewProps = {
  name: "Alex",
  calendlyUrl: "https://calendly.com/affisell/onboarding-affiliate",
} satisfies OnboardingAffiliateDay7EmailProps

export default OnboardingAffiliateDay7Email

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
  margin: "8px 0 4px",
}
