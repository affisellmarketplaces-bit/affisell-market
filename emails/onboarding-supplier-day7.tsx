import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components"

export type OnboardingSupplierDay7EmailProps = {
  name: string
  storefrontUrl: string
}

export function OnboardingSupplierDay7Email({ name, storefrontUrl }: OnboardingSupplierDay7EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Widget clawback — rassure tes affiliés</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            Boost : active la transparence <strong>clawback CGA art.5</strong> sur ta vitrine — tes
            affiliés voient le risque prorata et convertissent mieux.
          </Text>
          <Text style={text}>
            Les top fournisseurs Affisell affichent payout J+2 + politique clawback claire : moins
            de questions, plus de listings affiliés sur ton catalogue.
          </Text>
          <Button href={storefrontUrl} style={button}>
            Configurer ma vitrine
          </Button>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingSupplierDay7Email.PreviewProps = {
  name: "Sam",
  storefrontUrl: "https://affisell.com/dashboard/supplier/storefront",
} satisfies OnboardingSupplierDay7EmailProps

export default OnboardingSupplierDay7Email

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
