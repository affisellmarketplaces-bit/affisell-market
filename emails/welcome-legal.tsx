import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export type WelcomeLegalEmailProps = {
  name: string
  roleLabel: string
  preheader: string
  acceptedAt: string
  acceptedIp: string
  cguVersion: string
  cguHash: string
  roleDocLabel: string
  roleDocVersion: string
  roleDocHash: string
  privacyVersion: string
  privacyHash: string
  legalUrl: string
  gdprUrl: string
  dpoEmail: string
}

export function WelcomeLegalEmail({
  name,
  roleLabel,
  preheader,
  acceptedAt,
  acceptedIp,
  cguVersion,
  cguHash,
  roleDocLabel,
  roleDocVersion,
  roleDocHash,
  privacyVersion,
  privacyHash,
  legalUrl,
  gdprUrl,
  dpoEmail,
}: WelcomeLegalEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preheader}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Bienvenue chez Affisell</Heading>
          <Text style={text}>Bonjour {name},</Text>
          <Text style={text}>Votre compte {roleLabel} Affisell est actif.</Text>

          <Section style={card}>
            <Text style={cardTitle}>
              Conformément au RGPD art.7, vos consentements sont enregistrés :
            </Text>
            <Text style={mono}>
              • CGU v{cguVersion} : {cguHash}
            </Text>
            <Text style={mono}>
              • {roleDocLabel} v{roleDocVersion} : {roleDocHash}
            </Text>
            <Text style={mono}>
              • Politique Confidentialité v{privacyVersion} : {privacyHash}
            </Text>
            <Text style={meta}>Date : {acceptedAt}</Text>
            <Text style={meta}>IP : {acceptedIp}</Text>
          </Section>

          <Text style={text}>
            DPO :{" "}
            <Link href={`mailto:${dpoEmail}`} style={link}>
              {dpoEmail}
            </Link>
          </Text>
          <Text style={text}>
            Consulter :{" "}
            <Link href={legalUrl} style={link}>
              {legalUrl}
            </Link>
          </Text>
          <Text style={text}>
            Exercer vos droits :{" "}
            <Link href={gdprUrl} style={link}>
              {gdprUrl}
            </Link>
          </Text>

          <Text style={text}>Ces documents sont versionnés et horodatés.</Text>

          <Text style={footer}>Affisell SAS</Text>
        </Container>
      </Body>
    </Html>
  )
}

WelcomeLegalEmail.PreviewProps = {
  name: "Marie Dupont",
  roleLabel: "Affilié",
  preheader: "Consentements enregistrés le 10 juillet 2026 à 14:30",
  acceptedAt: "10 juillet 2026 à 14:30",
  acceptedIp: "203.0.113.42",
  cguVersion: "1.0.0",
  cguHash: "fb236ee2c5db695aa246bc51cf60d4d2cb2bf409f6513e89dfe3c742c6b1bbfb",
  roleDocLabel: "CGA",
  roleDocVersion: "1.0.0",
  roleDocHash: "1e0448f732ec78bd6cfb300057d2f276d6e2b18c78af0f68c8fbbc47bbaae90b",
  privacyVersion: "1.0.0",
  privacyHash: "78d004c56b707d210ce3f45b87c26d9c083566aa7f9052dec4ad919ea0b5ff16",
  legalUrl: "https://affisell.com/legal",
  gdprUrl: "https://affisell.com/gdpr",
  dpoEmail: "dpo@affisell.com",
} satisfies WelcomeLegalEmailProps

export default WelcomeLegalEmail

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = { margin: "0 auto", padding: "32px 16px", maxWidth: "560px" }
const h1 = { color: "#18181b", fontSize: "22px", fontWeight: "700", margin: "0 0 16px" }
const text = { color: "#3f3f46", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" }
const card = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e4e4e7",
  padding: "16px 20px",
  margin: "0 0 20px",
}
const cardTitle = { color: "#18181b", fontSize: "14px", fontWeight: "600", margin: "0 0 12px" }
const mono = {
  color: "#27272a",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "0 0 8px",
  wordBreak: "break-all" as const,
}
const meta = { color: "#52525b", fontSize: "13px", lineHeight: "20px", margin: "8px 0 0" }
const link = { color: "#7c3aed", textDecoration: "underline" }
const footer = { color: "#71717a", fontSize: "13px", margin: "24px 0 0" }
