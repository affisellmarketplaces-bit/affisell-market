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

export type SupplierWelcomeStockerEmailProps = {
  name: string
  radarUrl: string
}

export function SupplierWelcomeStockerEmail({
  name,
  radarUrl,
}: SupplierWelcomeStockerEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Tes 3 premiers produits à sourcer ce mois-ci sont prêts</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={headerBadge}>Affisell Radar</Text>
            <Heading style={headerTitle}>Cockpit Attaque</Heading>
          </Section>

          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            <strong>Bienvenue Stockeur.</strong> Tu as fait le choix le plus rentable.
          </Text>
          <Text style={text}>
            En tant que Stockeur, tu gardes <strong>100% de la marge</strong> et tu es mis en avant
            devant 200+ resellers.
          </Text>

          <Text style={listItem}>✓ Badge Stock 48h</Text>
          <Text style={listItem}>✓ Priorité algo</Text>
          <Text style={listItem}>✓ Cockpit Attaque GMC</Text>

          <Button href={radarUrl} style={button}>
            Voir mon Cockpit Attaque →
          </Button>

          <Text style={ps}>
            PS — Demain, je t&apos;envoie le produit #1 qui a fait 12k recherches avec seulement 4
            concurrents.
          </Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

SupplierWelcomeStockerEmail.PreviewProps = {
  name: "Alex",
  radarUrl: "https://affisell.com/radar",
} satisfies SupplierWelcomeStockerEmailProps

export default SupplierWelcomeStockerEmail

const main = { backgroundColor: "#ecfdf5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "0 0 24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden" as const,
}
const header = {
  backgroundColor: "#059669",
  padding: "20px 24px",
  marginBottom: "8px",
}
const headerBadge = {
  color: "#d1fae5",
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
  color: "#3f3f46",
  margin: "0 24px 12px",
}
const listItem = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#065f46",
  margin: "0 24px 8px",
  fontWeight: 600,
}
const button = {
  backgroundColor: "#059669",
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
  color: "#52525b",
  margin: "16px 24px 8px",
  fontStyle: "italic" as const,
}
const muted = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#71717a",
  margin: "8px 24px 0",
}
