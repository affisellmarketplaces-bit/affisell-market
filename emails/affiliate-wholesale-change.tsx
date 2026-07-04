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

export type AffiliateWholesaleChangeEmailProps = {
  affiliateName: string
  productName: string
  variantCount: number
  atLoss: boolean
  editUrl: string
}

export function AffiliateWholesaleChangeEmail({
  affiliateName,
  productName,
  variantCount,
  atLoss,
  editUrl,
}: AffiliateWholesaleChangeEmailProps) {
  const greeting = affiliateName.trim() ? affiliateName.trim() : "Partenaire"
  const variantLine =
    variantCount > 0
      ? `${variantCount} variante(s) concernée(s)`
      : "votre prix de référence"

  return (
    <Html>
      <Head />
      <Preview>Prix fournisseur en hausse — revoyez vos marges</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>✦ Affisell Partner</Text>
          <Heading style={h1}>Marge à revoir</Heading>
          <Text style={text}>Bonjour {greeting},</Text>
          <Text style={text}>
            Le fournisseur a augmenté ses prix sur <strong style={{ color: "#e2e8f0" }}>{productName}</strong> (
            {variantLine}).
            {atLoss ? " Votre prix actuel peut être inférieur au coût fournisseur." : ""}
          </Text>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={editUrl} style={button}>
              Ajuster mes marges
            </Button>
          </Section>
          <Text style={footer}>
            Astuce : utilisez « Appliquer l&apos;IA aux variantes » dans le modal pour recalculer en un clic.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#0f172a", fontFamily: "system-ui, sans-serif" }
const container = { margin: "0 auto", padding: "32px 20px", maxWidth: "520px" }
const badge = {
  color: "#c4b5fd",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
}
const h1 = { color: "#f8fafc", fontSize: "24px", fontWeight: 700, margin: "12px 0" }
const text = { color: "#cbd5e1", fontSize: "15px", lineHeight: "24px" }
const button = {
  backgroundColor: "#7c3aed",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
}
const footer = { color: "#64748b", fontSize: "12px", lineHeight: "20px", marginTop: "24px" }

export default AffiliateWholesaleChangeEmail
