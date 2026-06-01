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

export type PasswordResetEmailProps = {
  name?: string | null
  resetUrl: string
}

export function PasswordResetEmail({ name, resetUrl }: PasswordResetEmailProps) {
  const greeting = name?.trim() ? `Bonjour ${name.trim()},` : "Bonjour,"

  return (
    <Html lang="fr">
      <Head />
      <Preview>Réinitialisez votre mot de passe Affisell</Preview>
      <Body style={{ backgroundColor: "#09090b", fontFamily: "system-ui, sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "40px 20px", maxWidth: "480px" }}>
          <Text
            style={{
              color: "#c4b5fd",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Sécurité Affisell
          </Text>
          <Heading style={{ fontSize: "26px", color: "#fafafa", margin: "0 0 16px" }}>
            Réinitialiser votre mot de passe
          </Heading>
          <Text style={{ color: "#a1a1aa", lineHeight: 1.6, margin: "0 0 24px" }}>{greeting}</Text>
          <Text style={{ color: "#a1a1aa", lineHeight: 1.6, margin: "0 0 28px" }}>
            Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans
            1 heure.
          </Text>
          <Button
            href={resetUrl}
            style={{
              background: "linear-gradient(90deg, #7c3aed, #d946ef, #22d3ee)",
              color: "#ffffff",
              padding: "14px 28px",
              borderRadius: "16px",
              fontWeight: 700,
              fontSize: "15px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Réinitialiser mon mot de passe
          </Button>
          <Text style={{ color: "#71717a", fontSize: "13px", lineHeight: 1.6, marginTop: "28px" }}>
            Si vous n&apos;avez pas demandé cette réinitialisation, ignorez cet e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail
