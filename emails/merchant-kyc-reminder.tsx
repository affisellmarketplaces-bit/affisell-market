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

type Props = {
  name: string
  draftCount: number
  verifyUrl: string
  locale: "fr" | "en"
}

export function MerchantKycPublishReminderEmail({ name, draftCount, verifyUrl, locale }: Props) {
  const en = locale === "en"
  const preview = en
    ? `${draftCount} draft listing${draftCount > 1 ? "s" : ""} ready after KYC`
    : `${draftCount} brouillon${draftCount > 1 ? "s" : ""} prêt${draftCount > 1 ? "s" : ""} après KYC`

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {en ? "Almost ready to publish on Affisell" : "Vous y êtes presque sur Affisell"}
          </Heading>
          <Text style={text}>
            {en
              ? `Hi ${name}, you have ${draftCount} draft product${draftCount > 1 ? "s" : ""} waiting. Complete your merchant verification to go live in the EU marketplace.`
              : `Bonjour ${name}, vous avez ${draftCount} brouillon${draftCount > 1 ? "s" : ""} produit en attente. Finalisez votre vérification marchand pour publier sur la marketplace.`}
          </Text>
          <Button href={verifyUrl} style={button}>
            {en ? "Complete verification" : "Compléter la vérification"}
          </Button>
          <Text style={muted}>
            {en
              ? "Browse and prepare your catalog anytime — checkout goes live once KYC is approved."
              : "Préparez votre catalogue à tout moment — la vente s’ouvre dès validation du KYC."}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "24px auto",
  padding: "24px",
  borderRadius: "12px",
  maxWidth: "480px",
}
const h1 = { fontSize: "20px", fontWeight: 700, color: "#18181b" }
const text = { fontSize: "14px", lineHeight: "22px", color: "#3f3f46" }
const muted = { fontSize: "12px", lineHeight: "18px", color: "#71717a" }
const button = {
  backgroundColor: "#d97706",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "8px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  marginTop: "8px",
  marginBottom: "16px",
}
