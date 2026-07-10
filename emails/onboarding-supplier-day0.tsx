import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components"

export type OnboardingSupplierDay0EmailProps = {
  name: string
  onboardingUrl: string
  templateUrl: string
}

export function OnboardingSupplierDay0Email({
  name,
  onboardingUrl,
  templateUrl,
}: OnboardingSupplierDay0EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>KYC validé — importe ton catalogue CSV en 2 min</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>✦ Fournisseur Affisell</Text>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            <strong>KYC validé.</strong> Ton compte Stripe Connect est actif — tu peux encaisser. Prochaine
            étape : <strong>importe ton catalogue en 2 min</strong> pour être visible par 1000+ affiliés.
          </Text>
          <Text style={listItem}>1. Télécharge le template CSV</Text>
          <Text style={listItem}>2. Mappe tes colonnes (titre, prix, stock, images)</Text>
          <Text style={listItem}>3. Publie — live pour le réseau affilié</Text>
          <Button href={onboardingUrl} style={button}>
            Importer mon catalogue
          </Button>
          <Text style={text}>
            Template CSV :{" "}
            <Link href={templateUrl} style={link}>
              télécharger
            </Link>
          </Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingSupplierDay0Email.PreviewProps = {
  name: "Sam",
  onboardingUrl: "https://affisell.com/dashboard/supplier/onboarding",
  templateUrl: "https://affisell.com/api/supplier/import-csv?download=template",
} satisfies OnboardingSupplierDay0EmailProps

export default OnboardingSupplierDay0Email

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
}
const badge = {
  color: "#059669",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase" as const,
  margin: "0 0 12px",
}
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 12px" }
const listItem = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 8px", paddingLeft: "4px" }
const muted = { fontSize: "13px", lineHeight: "20px", color: "#71717a", margin: "16px 0 0" }
const button = {
  backgroundColor: "#059669",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 4px",
}
const link = { color: "#059669", textDecoration: "underline" }
