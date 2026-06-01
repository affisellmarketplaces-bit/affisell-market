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

export type PasswordResetPortal = "affiliate" | "supplier" | null

export type PasswordResetEmailProps = {
  name?: string | null
  /** Email linked to the Affisell account (shown in body + used as recipient in production). */
  accountEmail: string
  resetUrl: string
  portal?: PasswordResetPortal
}

const portalLabel: Record<NonNullable<PasswordResetPortal>, string> = {
  affiliate: "Espace créateur",
  supplier: "Espace fournisseur",
}

export function PasswordResetEmail({
  name,
  accountEmail,
  resetUrl,
  portal = null,
}: PasswordResetEmailProps) {
  const greeting = name?.trim() ? `Bonjour ${name.trim()},` : "Bonjour,"
  const spaceLabel = portal ? portalLabel[portal] : "Compte Affisell"

  return (
    <Html lang="fr">
      <Head />
      <Preview>
        Réinitialisez votre mot de passe Affisell — {accountEmail}
      </Preview>
      <Body style={page}>
        <Container style={outer}>
          <Section style={glowWrap}>
            <Section style={card}>
              <Text style={badge}>Sécurité Affisell · Accès sécurisé</Text>

              <Heading style={title}>Réinitialisez votre mot de passe</Heading>
              <Text style={subtitle}>{greeting}</Text>
              <Text style={bodyText}>
                Vous avez demandé un nouveau mot de passe. Ce lien est lié au compte ci-dessous et
                expire dans <strong style={{ color: "#e4e4e7" }}>1 heure</strong>.
              </Text>

              <Section style={accountBox}>
                <Text style={accountLabel}>Compte concerné</Text>
                <Text style={accountEmailStyle}>{accountEmail}</Text>
                <Text style={portalChip}>{spaceLabel}</Text>
              </Section>

              <Section style={{ textAlign: "center" as const, margin: "28px 0 20px" }}>
                <Button href={resetUrl} style={ctaButton}>
                  Réinitialiser mon mot de passe
                </Button>
              </Section>

              <Text style={fallbackLabel}>Si le bouton ne s&apos;ouvre pas, copiez ce lien :</Text>
              <Link href={resetUrl} style={fallbackLink}>
                {resetUrl}
              </Link>

              <Hr style={divider} />

              <Text style={footerNote}>
                Vous n&apos;êtes pas à l&apos;origine de cette demande ? Ignorez cet e-mail — votre
                mot de passe reste inchangé.
              </Text>
            </Section>
          </Section>

          <Text style={legal}>
            © Affisell — marketplace d&apos;affiliation ·{" "}
            <Link href="https://affisell.com" style={legalLink}>
              affisell.com
            </Link>
          </Text>
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

const legalLink = {
  color: "#a78bfa",
  textDecoration: "underline",
}

PasswordResetEmail.PreviewProps = {
  name: "Nelson",
  accountEmail: "dreamdealsprice@gmail.com",
  resetUrl: "https://affisell-market.vercel.app/auth/reset-password?token=preview&portal=affiliate",
  portal: "affiliate",
} satisfies PasswordResetEmailProps

export default PasswordResetEmail
