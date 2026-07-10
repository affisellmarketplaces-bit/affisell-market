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

export type OnboardingSupplierDay3EmailProps = {
  name: string
  payoutsUrl: string
  productsUrl?: string
}

export function OnboardingSupplierDay3Email({
  name,
  payoutsUrl,
  productsUrl,
}: OnboardingSupplierDay3EmailProps) {
  const boostUrl = productsUrl ?? payoutsUrl
  return (
    <Html>
      <Head />
      <Preview>0 ventes ? Baisse le prix 10% ou ajoute une vidéo</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            <strong>0 ventes encore ?</strong> Deux leviers qui convertissent sur Affisell :
          </Text>
          <Text style={listItem}>
            1. <strong>Baisse ton prix wholesale de 10%</strong> — les affiliés voient la marge en
            temps réel
          </Text>
          <Text style={listItem}>
            2. <strong>Ajoute une vidéo produit</strong> — +40% de clics catalogue en moyenne
          </Text>
          <Button href={boostUrl} style={button}>
            Booster mon catalogue
          </Button>
          <Text style={text}>
            Payout inchangé : <Link href={payoutsUrl} style={link}>Stripe Connect</Link> — J+2 après
            expédition.
          </Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingSupplierDay3Email.PreviewProps = {
  name: "Sam",
  payoutsUrl: "https://affisell.com/dashboard/supplier/settings/payouts",
} satisfies OnboardingSupplierDay3EmailProps

export default OnboardingSupplierDay3Email

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
