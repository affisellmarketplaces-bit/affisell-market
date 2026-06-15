import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export type ExpansionDigestEmailProps = {
  bodyText: string
}

export function ExpansionDigestEmail({ bodyText }: ExpansionDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Affisell expansion digest</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Expansion ROW digest</Heading>
          <Text style={text}>{bodyText}</Text>
          <Section>
            <Text style={footer}>Automated weekly summary — Affisell Admin</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
}
const h1 = { fontSize: "20px", fontWeight: 700, color: "#18181b", margin: "0 0 16px" }
const text = { fontSize: "14px", lineHeight: "22px", color: "#3f3f46", whiteSpace: "pre-wrap" as const }
const footer = { fontSize: "12px", color: "#71717a", margin: "24px 0 0" }

export default ExpansionDigestEmail
