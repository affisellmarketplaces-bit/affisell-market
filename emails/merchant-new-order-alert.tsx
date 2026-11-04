import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import type { MerchantNewOrderAlertCopy } from "@/lib/emails/merchant-order-alert-copy"

export type MerchantNewOrderAlertEmailProps = {
  productName: string
  variantLabel: string | null
  quantity: number
  buyerMasked: string
  partnerListingCode: string | null
  payoutLabel: string
  orderRef: string
  ordersUrl: string
  copy: MerchantNewOrderAlertCopy
}

/** Light transactional layout (same family as buyer order-confirmation) for Gmail deliverability. */
export function MerchantNewOrderAlertEmail({
  productName,
  variantLabel,
  quantity,
  buyerMasked,
  partnerListingCode,
  payoutLabel,
  orderRef,
  ordersUrl,
  copy,
}: MerchantNewOrderAlertEmailProps) {
  const productLine = variantLabel?.trim() ? `${productName} · ${variantLabel.trim()}` : productName

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Affisell · Fournisseur</Text>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.intro}</Text>
          <Text style={product}>{productLine}</Text>
          <Section style={box}>
            <Text style={label}>{copy.orderLabel}</Text>
            <Text style={value}>#{orderRef}</Text>
            <Text style={label}>{copy.qtyLabel}</Text>
            <Text style={value}>×{quantity}</Text>
            <Text style={label}>{copy.buyerLabel}</Text>
            <Text style={value}>{buyerMasked}</Text>
            {partnerListingCode ? (
              <>
                <Text style={label}>{copy.partnerLabel}</Text>
                <Text style={value}>{partnerListingCode}</Text>
              </>
            ) : null}
            <Text style={label}>{copy.payoutLabel}</Text>
            <Text style={value}>{payoutLabel}</Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={ordersUrl} style={button}>
              {copy.cta}
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "520px",
}
const brand = {
  color: "#5469d4",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
}
const h1 = { color: "#111827", fontSize: "22px", fontWeight: 700, margin: "0 0 12px" }
const text = { color: "#4b5563", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" }
const product = { color: "#111827", fontSize: "16px", fontWeight: 600, margin: "16px 0" }
const box = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "20px 0",
}
const label = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  margin: "12px 0 4px",
}
const value = { color: "#111827", fontSize: "15px", margin: "0 0 4px" }
const button = {
  backgroundColor: "#5469d4",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 700,
  padding: "12px 24px",
  textDecoration: "none",
}
const hr = { borderColor: "#e6ebf1", margin: "24px 0" }
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "18px", margin: 0 }
