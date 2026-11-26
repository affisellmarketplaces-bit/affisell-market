import { Body, Button, Container, Head, Heading, Html, Hr, Preview, Section, Text } from "@react-email/components"

import { EmailBrandHeader, emailAccent, emailOnAccent, type EmailBrandProps } from "@/lib/emails/email-brand-ui"

/** Every string is already resolved for the buyer's language; no id, reason or address is ever passed in. */
export type UnallocatedLineNoticeCopy = {
  preview: string
  heading: string
  greeting: string
  intro: string
  amountLine: string
  refundLine: string
  ctaSupport: string
  footerNote: string
}

export type UnallocatedLineNoticeProps = { copy: UnallocatedLineNoticeCopy; supportUrl: string; brand?: EmailBrandProps }

export const UnallocatedLineNoticeEmail = ({ copy, supportUrl, brand }: UnallocatedLineNoticeProps) => {
  const accent = emailAccent(brand)
  const onAccent = emailOnAccent(brand)
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailBrandHeader brand={brand} />
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.greeting}</Text>
          <Text style={text}>{copy.intro}</Text>
          <Section style={box}>
            <Text style={strong}>{copy.amountLine}</Text>
            <Text style={text}>{copy.refundLine}</Text>
          </Section>
          <Section style={{ padding: "0 40px", margin: "8px 0 24px" }}>
            <Button href={supportUrl} style={{ ...button, backgroundColor: accent, color: onAccent }}>
              {copy.ctaSupport}
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>{copy.footerNote}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default UnallocatedLineNoticeEmail

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" }
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "20px 0 48px", marginBottom: "64px", maxWidth: "600px" }
const h1 = { color: "#333", fontSize: "24px", fontWeight: "bold", padding: "0 40px" }
const text = { color: "#333", fontSize: "14px", lineHeight: "24px", padding: "0 40px", margin: "0 0 8px" }
const strong = { ...text, fontWeight: "bold" }
const box = { margin: "16px 40px", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px 0" }
const button = { borderRadius: "6px", fontSize: "14px", fontWeight: "bold", textDecoration: "none", padding: "12px 20px", display: "inline-block" }
const hr = { borderColor: "#e6ebf1", margin: "24px 40px" }
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "16px", padding: "0 40px" }
