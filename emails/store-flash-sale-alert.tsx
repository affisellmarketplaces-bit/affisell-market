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

export type StoreFlashSaleAlertProduct = {
  name: string
  priceLabel: string
}

export type StoreFlashSaleAlertEmailProps = {
  storeName: string
  shopUrl: string
  headline: string
  endsAtLabel: string
  products: StoreFlashSaleAlertProduct[]
  copy: {
    preview: string
    heading: string
    body: string
    endsLabel: string
    cta: string
    footer: string
  }
}

export function StoreFlashSaleAlertEmail({
  storeName,
  shopUrl,
  headline,
  endsAtLabel,
  products,
  copy,
}: StoreFlashSaleAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview.replace("{storeName}", storeName)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{headline}</Text>
          <Text style={text}>
            <strong>{copy.endsLabel}</strong> {endsAtLabel}
          </Text>
          {products.length > 0 ? (
            <Section style={productList}>
              {products.map((p) => (
                <Text key={p.name} style={productRow}>
                  {p.name} — <strong>{p.priceLabel}</strong>
                </Text>
              ))}
            </Section>
          ) : null}
          <Button href={shopUrl} style={button}>
            {copy.cta}
          </Button>
          <Text style={footer}>{copy.footer.replace("{storeName}", storeName)}</Text>
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
const text = { color: "#3f3f46", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" }
const productList = { margin: "8px 0 16px", padding: "12px 16px", backgroundColor: "#fafafa", borderRadius: "8px" }
const productRow = { color: "#3f3f46", fontSize: "14px", lineHeight: "22px", margin: "4px 0" }
const footer = { color: "#71717a", fontSize: "12px", lineHeight: "20px", marginTop: "24px" }
const button = {
  backgroundColor: "#dc2626",
  borderRadius: "8px",
  color: "#fff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600 as const,
  marginTop: "8px",
  padding: "12px 20px",
  textDecoration: "none",
}

export default StoreFlashSaleAlertEmail
