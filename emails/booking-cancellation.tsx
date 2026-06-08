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

export type BookingCancellationEmailCopy = {
  preview: string
  heading: string
  intro: string
  whenLabel: string
  seatsLabel: string
  refundLabel: string
  footer: string
}

export type BookingCancellationEmailProps = {
  productName: string
  startsAtLabel: string
  seatLabels: string | null
  copy: BookingCancellationEmailCopy
}

export function BookingCancellationEmail({
  productName,
  startsAtLabel,
  seatLabels,
  copy,
}: BookingCancellationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.intro}</Text>
          <Text style={product}>{productName}</Text>
          <Section style={box}>
            <Text style={label}>{copy.whenLabel}</Text>
            <Text style={value}>{startsAtLabel}</Text>
            {seatLabels ? (
              <>
                <Text style={label}>{copy.seatsLabel}</Text>
                <Text style={value}>{seatLabels}</Text>
              </>
            ) : null}
            <Text style={label}>{copy.refundLabel}</Text>
          </Section>
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#0b1020", fontFamily: "system-ui, sans-serif" }
const container = { margin: "0 auto", padding: "32px 20px", maxWidth: "520px" }
const h1 = { color: "#f8fafc", fontSize: "22px", fontWeight: 700 as const, margin: "0 0 12px" }
const text = { color: "#cbd5e1", fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px" }
const product = { color: "#67e8f9", fontSize: "16px", fontWeight: 600 as const, margin: "0 0 20px" }
const box = {
  backgroundColor: "#111827",
  borderRadius: "12px",
  border: "1px solid #1e3a5f",
  padding: "16px",
  margin: "0 0 20px",
}
const label = { color: "#94a3b8", fontSize: "11px", textTransform: "uppercase" as const, margin: "0 0 4px" }
const value = { color: "#f1f5f9", fontSize: "14px", margin: "0 0 12px" }
const footer = { color: "#64748b", fontSize: "12px", lineHeight: "1.5", margin: "24px 0 0" }
