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

export type BrandPulseNudgeEmailProps = {
  name: string
  storeName: string
  score: number
  brandStudioUrl: string
  locale?: "fr" | "en"
}

export function BrandPulseNudgeEmail({
  name,
  storeName,
  score,
  brandStudioUrl,
  locale = "fr",
}: BrandPulseNudgeEmailProps) {
  const isEn = locale === "en"
  return (
    <Html>
      <Head />
      <Preview>
        {isEn
          ? `${storeName} — Brand Pulse ${score}/100 — finish your storefront`
          : `${storeName} — Brand Pulse ${score}/100 — finalisez votre vitrine`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{isEn ? "Your storefront is almost ready" : "Votre vitrine est presque prête"}</Heading>
          <Text style={text}>
            {isEn ? `Hi ${name},` : `Bonjour ${name},`}
          </Text>
          <Text style={text}>
            {isEn
              ? `Your shop "${storeName}" scores ${score}/100 on Brand Pulse — a few quick updates can unlock more trust and conversion.`
              : `Votre boutique « ${storeName} » affiche ${score}/100 au Brand Pulse — quelques réglages rapides améliorent confiance et conversion.`}
          </Text>
          <Button href={brandStudioUrl} style={button}>
            {isEn ? "Open Brand Studio" : "Ouvrir Brand Studio"}
          </Button>
          <Text style={muted}>
            {isEn
              ? "Tip: add a hero banner, enable static pages (About, FAQ, Returns), and share your live link."
              : "Astuce : ajoutez une bannière hero, activez les pages statiques (À propos, FAQ, Retours) et partagez votre lien live."}
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
