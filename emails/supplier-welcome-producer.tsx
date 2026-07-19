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

export type SupplierWelcomeProducerEmailProps = {
  name: string
  radarUrl: string
}

export function SupplierWelcomeProducerEmail({
  name,
  radarUrl,
}: SupplierWelcomeProducerEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Comment protéger ta marque de la copie chinoise (en 24h)</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={headerBadge}>Affisell Radar</Text>
            <Heading style={headerTitle}>Bouclier Défense</Heading>
          </Section>

          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            <strong>Bienvenue Producteur.</strong> Tu as construit une marque, on va la protéger.
          </Text>
          <Text style={text}>
            En tant que Producteur, Affisell devient ton <strong>bouclier anti-copie</strong>.
          </Text>

          <Text style={listItem}>✓ Alerte copie GMC</Text>
          <Text style={listItem}>✓ Protection prix reseller</Text>
          <Text style={listItem}>✓ Top 20 resellers FR</Text>

          <Button href={radarUrl} style={button}>
            Activer mon bouclier Défense →
          </Button>

          <Text style={ps}>
            PS — Demain, je te montre qui vend déjà des copies de ta marque sur Google.
          </Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

SupplierWelcomeProducerEmail.PreviewProps = {
  name: "Camille",
  radarUrl: "https://affisell.com/radar",
} satisfies SupplierWelcomeProducerEmailProps

export default SupplierWelcomeProducerEmail

const main = { backgroundColor: "#0a0a0b", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "0 0 24px",
  maxWidth: "520px",
  backgroundColor: "#18181b",
  borderRadius: "12px",
  overflow: "hidden" as const,
  border: "1px solid #3f3f46",
}
const header = {
  background: "linear-gradient(135deg, #18181b 0%, #4c1d95 100%)",
  backgroundColor: "#4c1d95",
  padding: "20px 24px",
  marginBottom: "8px",
}
const headerBadge = {
  color: "#c4b5fd",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
}
const headerTitle = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0",
  lineHeight: "28px",
}
const text = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#d4d4d8",
  margin: "0 24px 12px",
}
const listItem = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#c4b5fd",
  margin: "0 24px 8px",
  fontWeight: 600,
}
const button = {
  backgroundColor: "#7C3AED",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "12px 24px 8px",
}
const ps = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#a1a1aa",
  margin: "16px 24px 8px",
  fontStyle: "italic" as const,
}
const muted = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#71717a",
  margin: "8px 24px 0",
}
