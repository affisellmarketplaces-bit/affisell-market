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

export type DigitalAccessPassEmailCopy = {
  preview: string
  heading: string
  intro: string
  cta: string
  instructionsLabel: string
  footer: string
}

export type DigitalAccessPassEmailProps = {
  productName: string
  passUrl: string
  accessUrl: string
  instructions: string | null
  copy: DigitalAccessPassEmailCopy
}

export function DigitalAccessPassEmail({
  productName,
  passUrl,
  accessUrl,
  instructions,
  copy,
}: DigitalAccessPassEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={glow}>
            <Text style={badge}>✦ Affisell Digital Pass</Text>
            <Heading style={h1}>{copy.heading}</Heading>
            <Text style={text}>{copy.intro}</Text>
            <Text style={product}>{productName}</Text>
            <Section style={{ textAlign: "center", margin: "28px 0" }}>
              <Button href={passUrl} style={buttonPrimary}>
                {copy.cta}
              </Button>
            </Section>
            {instructions ? (
              <Section style={instructionsBox}>
                <Text style={instructionsTitle}>{copy.instructionsLabel}</Text>
                <Text style={instructionsBody}>{instructions}</Text>
              </Section>
            ) : null}
            <Text style={linkHint}>
              Direct link:{" "}
              <a href={accessUrl} style={link}>
                {accessUrl}
              </a>
            </Text>
            <Text style={footer}>{copy.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#0a0a0f",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = { margin: "0 auto", padding: "32px 16px", maxWidth: "560px" }

const glow = {
  background: "linear-gradient(145deg, #1a1033 0%, #0f172a 50%, #042f2e 100%)",
  borderRadius: "20px",
  border: "1px solid rgba(139, 92, 246, 0.35)",
  padding: "32px 28px",
  boxShadow: "0 0 60px rgba(124, 58, 237, 0.25)",
}

const badge = {
  color: "#a78bfa",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  margin: "0 0 16px",
}

const h1 = { color: "#f8fafc", fontSize: "26px", fontWeight: 700, margin: "0 0 12px", lineHeight: 1.25 }

const text = { color: "#cbd5e1", fontSize: "15px", lineHeight: 1.6, margin: "0 0 16px" }

const product = { color: "#e9d5ff", fontSize: "16px", fontWeight: 600, margin: "0 0 8px" }

const buttonPrimary = {
  backgroundColor: "#7c3aed",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "14px 28px",
  display: "inline-block",
}

const instructionsBox = {
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  padding: "16px",
  margin: "20px 0",
}

const instructionsTitle = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
}

const instructionsBody = { color: "#e2e8f0", fontSize: "14px", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" as const }

const linkHint = { color: "#64748b", fontSize: "12px", lineHeight: 1.5, margin: "24px 0 0", wordBreak: "break-all" as const }

const link = { color: "#a78bfa" }

const footer = { color: "#475569", fontSize: "12px", margin: "16px 0 0", lineHeight: 1.5 }

export default DigitalAccessPassEmail
