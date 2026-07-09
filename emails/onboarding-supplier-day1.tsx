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

export type OnboardingSupplierDay1EmailProps = {
  name: string
  importUrl: string
  templateUrl: string
}

export function OnboardingSupplierDay1Email({
  name,
  importUrl,
  templateUrl,
}: OnboardingSupplierDay1EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Template CSV prêt — import catalogue en 10 min</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            Étape 1 fournisseur : <strong>importe ton catalogue CSV</strong> pour être visible par
            1000+ affiliés.
          </Text>
          <Text style={text}>Checklist :</Text>
          <Text style={listItem}>1. Télécharge le template (SKU, titre, prix HT, stock)</Text>
          <Text style={listItem}>2. Remplis tes lignes produits</Text>
          <Text style={listItem}>3. Importe depuis le dashboard</Text>
          <Button href={importUrl} style={button}>
            Importer mon catalogue
          </Button>
          <Text style={text}>
            Template CSV :{" "}
            <Link href={templateUrl} style={link}>
              {templateUrl}
            </Link>
          </Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingSupplierDay1Email.PreviewProps = {
  name: "Sam",
  importUrl: "https://affisell.com/dashboard/supplier/bulk-import",
  templateUrl: "https://affisell.com/dashboard/supplier/bulk-import",
} satisfies OnboardingSupplierDay1EmailProps

export default OnboardingSupplierDay1Email

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
const link = { color: "#7c3aed", textDecoration: "underline" }
