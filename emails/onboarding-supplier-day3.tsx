import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components"

export type OnboardingSupplierDay3EmailProps = {
  name: string
  payoutsUrl: string
}

export function OnboardingSupplierDay3Email({ name, payoutsUrl }: OnboardingSupplierDay3EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>1ère vente = payout J+2 après expédition</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            Ta <strong>1ère vente = payout J+2</strong> après expédition confirmée — connecte Stripe
            Connect pour encaisser sans friction.
          </Text>
          <Text style={text}>
            Flow : commande reçue → expédition + tracking → payout automatique sur ton compte
            bancaire. Commission Affisell prélevée à la source.
          </Text>
          <Button href={payoutsUrl} style={button}>
            Activer Stripe Connect
          </Button>
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
