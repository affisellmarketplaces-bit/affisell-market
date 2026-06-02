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

export interface ContactAcknowledgmentEmailProps {
  customerName: string
  subject: string
  ticketRef: string
  faqUrl: string
  ordersUrl: string
  supportEmail: string
}

export const ContactAcknowledgmentEmail = ({
  customerName,
  subject,
  ticketRef,
  faqUrl,
  ordersUrl,
  supportEmail,
}: ContactAcknowledgmentEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Message reçu — Affisell #{ticketRef}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Message bien reçu</Heading>
          <Text style={text}>Bonjour {customerName},</Text>
          <Text style={text}>
            Nous avons bien reçu votre demande concernant « {subject} ». Notre équipe vous répond sous{" "}
            <strong>48 h ouvrées</strong> en général.
          </Text>
          <Text style={muted}>Référence : #{ticketRef}</Text>

          <Section style={card}>
            <Text style={cardTitle}>En attendant, ces liens résolvent 80 % des questions :</Text>
            <Text style={text}>
              •{" "}
              <Link href={faqUrl} style={link}>
                FAQ — commandes, livraison, retours
              </Link>
            </Text>
            <Text style={text}>
              •{" "}
              <Link href={ordersUrl} style={link}>
                Mes commandes — suivi et retours
              </Link>
            </Text>
          </Section>

          <Button href={faqUrl} style={button}>
            Ouvrir la FAQ
          </Button>

          <Text style={footer}>
            Besoin d&apos;ajouter un détail ? Répondez à cet e-mail ou écrivez à{" "}
            <Link href={`mailto:${supportEmail}`} style={link}>
              {supportEmail}
            </Link>
            en citant #{ticketRef}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

ContactAcknowledgmentEmail.PreviewProps = {
  customerName: "Marie",
  subject: "Où est ma commande ?",
  ticketRef: "A4F2B1",
  faqUrl: "https://affisell.com/faq",
  ordersUrl: "https://affisell.com/marketplace/account/orders",
  supportEmail: "support@affisell.com",
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
