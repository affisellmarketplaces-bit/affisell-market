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

import type { CustomDomainActivationState } from "@/lib/custom-domain-activation-shared"

export type CustomDomainNudgeEmailProps = {
  name: string
  storeName: string
  activationState: CustomDomainActivationState
  customDomain?: string | null
  dnsTarget: string
  settingsUrl: string
  locale?: "fr" | "en"
}

export function CustomDomainNudgeEmail({
  name,
  storeName,
  activationState,
  customDomain,
  dnsTarget,
  settingsUrl,
  locale = "fr",
}: CustomDomainNudgeEmailProps) {
  const isEn = locale === "en"
  const domain = customDomain?.trim()

  const preview =
    activationState === "needs_domain"
      ? isEn
        ? `${storeName} — activate your pro domain in 1 click`
        : `${storeName} — activez votre domaine pro en 1 clic`
      : activationState === "needs_dns"
        ? isEn
          ? `${domain} — finish DNS to go live on your brand`
          : `${domain} — finalisez le DNS pour votre marque`
        : isEn
          ? `${domain} — SSL almost ready on Vercel`
          : `${domain} — SSL presque prêt sur Vercel`

  const heading = isEn ? "Your brand deserves its own domain" : "Votre marque mérite son propre domaine"

  const body =
    activationState === "needs_domain"
      ? isEn
        ? `Hi ${name}, your shop "${storeName}" is still on a generic Affisell URL. Connect boutique.com (or your domain) — buyers trust custom domains and convert better.`
        : `Bonjour ${name}, votre boutique « ${storeName} » est encore sur une URL Affisell générique. Branchez boutique.com (ou votre domaine) — les acheteurs font plus confiance aux domaines pro.`
      : activationState === "needs_dns"
        ? isEn
          ? `Hi ${name}, "${customDomain}" is saved for "${storeName}" but DNS is not verified yet. Add a CNAME record pointing to ${dnsTarget}, then click Activate domain + SSL in Store settings.`
          : `Bonjour ${name}, « ${customDomain} » est enregistré pour « ${storeName} » mais le DNS n'est pas vérifié. Ajoutez un CNAME vers ${dnsTarget}, puis cliquez sur Activer le domaine + SSL dans les paramètres boutique.`
        : isEn
          ? `Hi ${name}, DNS for "${customDomain}" is verified — finish SSL activation in one click from Store settings (usually live within 30 minutes on Vercel).`
          : `Bonjour ${name}, le DNS de « ${customDomain} » est vérifié — finalisez l'activation SSL en 1 clic depuis les paramètres boutique (souvent actif sous 30 min sur Vercel).`

  const cta =
    activationState === "needs_domain"
      ? isEn
        ? "Set up custom domain"
        : "Configurer mon domaine"
      : isEn
        ? "Activate domain + SSL"
        : "Activer domaine + SSL"

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>{body}</Text>
          {activationState === "needs_dns" && domain ? (
            <Text style={code}>
              CNAME · {domain} → {dnsTarget}
            </Text>
          ) : null}
          <Button href={settingsUrl} style={button}>
            {cta}
          </Button>
          <Text style={muted}>
            {isEn
              ? "Pro tip: shops on a custom domain look more trustworthy and share better on social."
              : "Astuce : une boutique sur domaine custom inspire plus confiance et se partage mieux."}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
}
const h1 = { fontSize: "22px", fontWeight: 700, color: "#18181b", margin: "0 0 16px" }
const text = { fontSize: "15px", lineHeight: "1.5", color: "#3f3f46", margin: "0 0 12px" }
const code = {
  fontSize: "13px",
  lineHeight: "1.45",
  color: "#18181b",
  backgroundColor: "#f4f4f5",
  padding: "10px 12px",
  borderRadius: "8px",
  fontFamily: "ui-monospace, monospace",
  margin: "0 0 16px",
}
const muted = { fontSize: "13px", lineHeight: "1.45", color: "#71717a", margin: "16px 0 0" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
}
