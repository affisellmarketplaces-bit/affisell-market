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

export type ExpansionGraduationFounderAlertEmailProps = {
  countryName: string
  countryIso2: string
  adminConsoleUrl: string
  firstOrderId: string | null
}

export function ExpansionGraduationFounderAlertEmail({
  countryName,
  countryIso2,
  adminConsoleUrl,
  firstOrderId,
}: ExpansionGraduationFounderAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{countryName} graduated to permanent Affisell checkout</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>🌍 Affisell Expansion</Text>
          <Heading style={h1}>{countryName} is now permanent checkout</Heading>
          <Text style={text}>
            Rollout <strong>{countryIso2}</strong> graduated to the permanent Stripe checkout base after a
            validated first order. Buyer graduation emails are queued automatically — confirm in the admin
            console.
          </Text>
          {firstOrderId ? (
            <Text style={meta}>First order: {firstOrderId}</Text>
          ) : null}
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={adminConsoleUrl} style={button}>
              Open expansion console
            </Button>
          </Section>
          <Text style={footer}>
            Metabase: filter business logs on <code>[expansion-rollout]</code> · result{" "}
            <code>graduated</code> or <code>graduation_emails_sent</code>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
}
const badge = { fontSize: "12px", fontWeight: 700, color: "#7c3aed", margin: "0 0 12px" }
const h1 = { fontSize: "22px", fontWeight: 700, color: "#18181b", margin: "0 0 16px" }
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 12px" }
const meta = { fontSize: "12px", color: "#71717a", margin: "0 0 16px" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
}
const footer = { fontSize: "12px", lineHeight: "18px", color: "#71717a", margin: "24px 0 0" }

export default ExpansionGraduationFounderAlertEmail

ExpansionGraduationFounderAlertEmail.PreviewProps = {
  countryName: "Japan",
  countryIso2: "JP",
  adminConsoleUrl: "https://affisell.com/admin/expansion",
  firstOrderId: "ord_demo_123",
} satisfies ExpansionGraduationFounderAlertEmailProps
