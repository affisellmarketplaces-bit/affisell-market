import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components"

export type StoreNewsletterWelcomeEmailProps = {
  storeName: string
  shopUrl: string
  copy: {
    preview: string
    heading: string
    body: string
    cta: string
    footer: string
  }
}

export function StoreNewsletterWelcomeEmail({
  storeName,
  shopUrl,
  copy,
}: StoreNewsletterWelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.body.replace("{storeName}", storeName)}</Text>
          <Button href={shopUrl} style={button}>
            {copy.cta}
          </Button>
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "Inter, system-ui, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "24px auto",
  padding: "24px",
  borderRadius: "12px",
  maxWidth: "520px",
}
const h1 = { color: "#18181b", fontSize: "22px", fontWeight: 700 as const, margin: "0 0 16px" }
const text = { color: "#3f3f46", fontSize: "15px", lineHeight: "24px" }
const footer = { color: "#71717a", fontSize: "12px", lineHeight: "20px", marginTop: "24px" }
const button = {
  backgroundColor: "#7c3aed",
  borderRadius: "8px",
  color: "#fff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600 as const,
  marginTop: "16px",
  padding: "12px 20px",
  textDecoration: "none",
}

export default StoreNewsletterWelcomeEmail
