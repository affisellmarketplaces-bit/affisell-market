import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import type { ContactAcknowledgmentEmailCopy } from "@/lib/emails/load-email-copy"

export interface ContactAcknowledgmentEmailProps {
  faqUrl: string
  ordersUrl: string
  supportEmail: string
  copy: ContactAcknowledgmentEmailCopy
}

export const ContactAcknowledgmentEmail = ({
  faqUrl,
  ordersUrl,
  supportEmail,
  copy,
}: ContactAcknowledgmentEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.greeting}</Text>
          <Text style={text}>{copy.body}</Text>
          <Text style={muted}>{copy.reference}</Text>

          <Section style={card}>
            <Text style={cardTitle}>{copy.cardTitle}</Text>
            <Text style={text}>
              •{" "}
              <Link href={faqUrl} style={link}>
                {copy.faqLink}
              </Link>
            </Text>
            <Text style={text}>
              •{" "}
              <Link href={ordersUrl} style={link}>
                {copy.ordersLink}
              </Link>
            </Text>
          </Section>

          <Button href={faqUrl} style={button}>
            {copy.ctaFaq}
          </Button>

          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

ContactAcknowledgmentEmail.PreviewProps = {
  faqUrl: "https://affisell.com/faq",
  ordersUrl: "https://affisell.com/marketplace/account/orders",
  supportEmail: "support@affisell.com",
  copy: {
    preview: "Message reçu — Affisell #A4F2B1",
    heading: "Message bien reçu",
    greeting: "Bonjour Marie,",
    body: "Nous avons bien reçu votre demande concernant « Où est ma commande ? ». Notre équipe vous répond sous 48 h ouvrées en général.",
    reference: "Référence : #A4F2B1",
    cardTitle: "En attendant, ces liens résolvent 80 % des questions :",
    faqLink: "FAQ — commandes, livraison, retours",
    ordersLink: "Mes commandes — suivi et retours",
    ctaFaq: "Ouvrir la FAQ",
    footer:
      "Besoin d'ajouter un détail ? Répondez à cet e-mail ou écrivez à support@affisell.com en citant #A4F2B1.",
  },
} satisfies ContactAcknowledgmentEmailProps

export default ContactAcknowledgmentEmail

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = { margin: "0 auto", padding: "32px 16px", maxWidth: "520px" }
const h1 = { color: "#18181b", fontSize: "22px", fontWeight: "700", margin: "0 0 16px" }
const text = { color: "#3f3f46", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" }
const muted = { color: "#71717a", fontSize: "13px", margin: "0 0 20px" }
const card = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e4e4e7",
  padding: "16px 20px",
  margin: "0 0 24px",
}
const cardTitle = { color: "#18181b", fontSize: "14px", fontWeight: "600", margin: "0 0 12px" }
const button = {
  backgroundColor: "#7c3aed",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
}
const link = { color: "#7c3aed", textDecoration: "underline" }
const footer = { color: "#71717a", fontSize: "13px", lineHeight: "20px", margin: "24px 0 0" }
