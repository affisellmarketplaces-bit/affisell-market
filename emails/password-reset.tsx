import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import type { PasswordResetEmailCopy } from "@/lib/emails/load-email-copy"

export type PasswordResetPortal = "affiliate" | "supplier" | null

export type PasswordResetEmailProps = {
  accountEmail: string
  resetUrl: string
  copy: PasswordResetEmailCopy
}

export function PasswordResetEmail({ accountEmail, resetUrl, copy }: PasswordResetEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={page}>
        <Container style={outer}>
          <Section style={glowWrap}>
            <Section style={card}>
              <Text style={badge}>{copy.badge}</Text>

              <Heading style={title}>{copy.title}</Heading>
              <Text style={subtitle}>{copy.greeting}</Text>
              <Text style={bodyText}>{copy.body}</Text>

              <Section style={accountBox}>
                <Text style={accountLabel}>{copy.accountLabel}</Text>
                <Text style={accountEmailStyle}>{accountEmail}</Text>
                <Text style={portalChip}>{copy.spaceLabel}</Text>
              </Section>

              <Section style={{ textAlign: "center" as const, margin: "28px 0 20px" }}>
                <Button href={resetUrl} style={ctaButton}>
                  {copy.cta}
                </Button>
              </Section>

              <Text style={fallbackLabel}>{copy.fallbackLabel}</Text>
              <Link href={resetUrl} style={fallbackLink}>
                {resetUrl}
              </Link>

              <Hr style={divider} />

              <Text style={footerNote}>{copy.footerNote}</Text>
            </Section>
          </Section>

          <Text style={legal}>{copy.legal}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const page = {
  backgroundColor: "#09090b",
  margin: 0,
  padding: "32px 12px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

const outer = {
  margin: "0 auto",
  maxWidth: "520px",
}

const glowWrap = {
  borderRadius: "24px",
  padding: "1px",
  background: "linear-gradient(135deg, #7c3aed 0%, #d946ef 45%, #22d3ee 100%)",
}

const card = {
  backgroundColor: "#18181b",
  borderRadius: "23px",
  padding: "36px 28px",
}

const badge = {
  color: "#c4b5fd",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase" as const,
  margin: "0 0 16px",
  textAlign: "center" as const,
}

const title = {
  color: "#fafafa",
  fontSize: "26px",
  fontWeight: 700,
  lineHeight: 1.25,
  margin: "0 0 12px",
  textAlign: "center" as const,
}

const subtitle = {
  color: "#d4d4d8",
  fontSize: "15px",
  lineHeight: 1.5,
  margin: "0 0 8px",
  textAlign: "center" as const,
}

const bodyText = {
  color: "#a1a1aa",
  fontSize: "14px",
  lineHeight: 1.65,
  margin: "0 0 20px",
  textAlign: "center" as const,
}

const accountBox = {
  backgroundColor: "rgba(139, 92, 246, 0.12)",
  border: "1px solid rgba(167, 139, 250, 0.35)",
  borderRadius: "16px",
  padding: "16px 18px",
  margin: "0 0 8px",
  textAlign: "center" as const,
}

const accountLabel = {
  color: "#a78bfa",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase" as const,
  margin: "0 0 6px",
}

const accountEmailStyle = {
  color: "#fafafa",
  fontSize: "16px",
  fontWeight: 600,
  margin: "0 0 8px",
  wordBreak: "break-all" as const,
}

const portalChip = {
  display: "inline-block",
  backgroundColor: "rgba(34, 211, 238, 0.12)",
  border: "1px solid rgba(34, 211, 238, 0.35)",
  borderRadius: "999px",
  color: "#67e8f9",
  fontSize: "11px",
  fontWeight: 600,
  margin: 0,
  padding: "4px 12px",
}

const ctaButton = {
  backgroundColor: "#7c3aed",
  backgroundImage: "linear-gradient(90deg, #7c3aed, #c026d3, #0891b2)",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  borderRadius: "14px",
  padding: "14px 32px",
  display: "inline-block",
}

const fallbackLabel = {
  color: "#71717a",
  fontSize: "12px",
  margin: "0 0 6px",
  textAlign: "center" as const,
}

const fallbackLink = {
  color: "#a78bfa",
  fontSize: "11px",
  lineHeight: 1.5,
  wordBreak: "break-all" as const,
  textAlign: "center" as const,
  display: "block",
}

const divider = {
  borderColor: "rgba(255,255,255,0.08)",
  margin: "24px 0 16px",
}

const footerNote = {
  color: "#71717a",
  fontSize: "12px",
  lineHeight: 1.6,
  margin: 0,
  textAlign: "center" as const,
}

const legal = {
  color: "#52525b",
  fontSize: "11px",
  lineHeight: 1.5,
  margin: "20px 0 0",
  textAlign: "center" as const,
}

PasswordResetEmail.PreviewProps = {
  accountEmail: "dreamdealsprice@gmail.com",
  resetUrl: "https://affisell-market.vercel.app/auth/reset-password?token=preview&portal=affiliate",
  copy: {
    preview: "Réinitialisez votre mot de passe Affisell — dreamdealsprice@gmail.com",
    badge: "Sécurité Affisell · Accès sécurisé",
    title: "Réinitialisez votre mot de passe",
    greeting: "Bonjour Nelson,",
    body: "Vous avez demandé un nouveau mot de passe. Ce lien est lié au compte ci-dessous et expire dans 1 heure.",
    accountLabel: "Compte concerné",
    spaceLabel: "Espace créateur",
    cta: "Réinitialiser mon mot de passe",
    fallbackLabel: "Si le bouton ne s'ouvre pas, copiez ce lien :",
    footerNote:
      "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail — votre mot de passe reste inchangé.",
    legal: "© Affisell — marketplace d'affiliation · affisell.com",
  },
} satisfies PasswordResetEmailProps

export default PasswordResetEmail
