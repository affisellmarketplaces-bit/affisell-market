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
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "32px 16px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "22px", color: "#18181b" }}>Mot de passe oublié</Heading>
          <Text style={{ color: "#3f3f46", lineHeight: 1.5 }}>{greeting}</Text>
          <Text style={{ color: "#3f3f46", lineHeight: 1.5 }}>
            Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire
            dans 1 heure.
          </Text>
          <Button
            href={resetUrl}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "12px",
              fontWeight: 600,
            }}
          >
            Réinitialiser mon mot de passe
          </Button>
          <Text style={{ color: "#71717a", fontSize: "13px", lineHeight: 1.5 }}>
            Si vous n&apos;avez pas demandé cette réinitialisation, ignorez cet e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail
