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

export type BookingAccessPassEmailCopy = {
  preview: string
  heading: string
  intro: string
  cta: string
  whenLabel: string
  venueLabel: string
  footer: string
}

export type BookingAccessPassEmailProps = {
  productName: string
  passUrl: string
  startsAtLabel: string
  venueLabel: string | null
  copy: BookingAccessPassEmailCopy
}

export function BookingAccessPassEmail({
  productName,
  passUrl,
  startsAtLabel,
  venueLabel,
  copy,
}: BookingAccessPassEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={glow}>
            <Text style={badge}>◷ Affisell Booking Pass</Text>
            <Heading style={h1}>{copy.heading}</Heading>
            <Text style={text}>{copy.intro}</Text>
            <Text style={product}>{productName}</Text>
            <Section style={whenBox}>
              <Text style={whenTitle}>{copy.whenLabel}</Text>
              <Text style={whenBody}>{startsAtLabel}</Text>
              {venueLabel ? (
                <>
                  <Text style={whenTitle}>{copy.venueLabel}</Text>
                  <Text style={whenBody}>{venueLabel}</Text>
                </>
              ) : null}
            </Section>
            <Section style={{ textAlign: "center", margin: "28px 0" }}>
              <Button href={passUrl} style={buttonPrimary}>
                {copy.cta}
              </Button>
            </Section>
            <Text style={footer}>{copy.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#050810",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = { margin: "0 auto", padding: "32px 16px", maxWidth: "560px" }

const glow = {
  background: "linear-gradient(145deg, #042f2e 0%, #0f172a 45%, #1e1b4b 100%)",
  borderRadius: "24px",
  padding: "32px 28px",
  border: "1px solid rgba(34, 211, 238, 0.25)",
}

const badge = {
  color: "#67e8f9",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  margin: "0 0 16px",
}

const h1 = { color: "#ecfeff", fontSize: "26px", fontWeight: "700", margin: "0 0 12px" }
const text = { color: "#cffafe", fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" }
const product = { color: "#ffffff", fontSize: "18px", fontWeight: "600", margin: "0 0 20px" }
const whenBox = {
  backgroundColor: "rgba(0,0,0,0.35)",
  borderRadius: "16px",
  padding: "16px",
  marginBottom: "8px",
  border: "1px solid rgba(255,255,255,0.08)",
}
const whenTitle = {
  color: "#94a3b8",
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "0.15em",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
}
const whenBody = { color: "#e2e8f0", fontSize: "14px", margin: "0 0 12px" }
const buttonPrimary = {
  backgroundColor: "#0891b2",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  padding: "14px 28px",
}
const footer = { color: "#64748b", fontSize: "12px", lineHeight: "20px", margin: "24px 0 0" }

export default BookingAccessPassEmail
