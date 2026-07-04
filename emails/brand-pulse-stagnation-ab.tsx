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

export type BrandPulseStagnationAbEmailProps = {
  name: string
  storeName: string
  score: number
  lastScore: number
  challengerPresetId: string
  brandStudioUrl: string
  locale?: "fr" | "en"
}

export function BrandPulseStagnationAbEmail({
  name,
  storeName,
  score,
  lastScore,
  challengerPresetId,
  brandStudioUrl,
  locale = "fr",
}: BrandPulseStagnationAbEmailProps) {
  const isEn = locale === "en"
  return (
    <Html>
      <Head />
      <Preview>
        {isEn
          ? `${storeName} — Brand Pulse flat at ${score}/100 — A/B test started`
          : `${storeName} — Brand Pulse stable à ${score}/100 — test A/B lancé`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isEn ? "We started a preset A/B test for you" : "Nous avons lancé un test A/B preset pour vous"}
          </Heading>
          <Text style={text}>{isEn ? `Hi ${name},` : `Bonjour ${name},`}</Text>
          <Text style={text}>
            {isEn
              ? `Your Brand Pulse score for "${storeName}" stayed at ${score}/100 (was ${lastScore}/100 last week). To unlock more conversion, we started a 50/50 preset A/B test.`
              : `Votre score Brand Pulse pour « ${storeName} » est resté à ${score}/100 (contre ${lastScore}/100 la semaine dernière). Pour débloquer plus de conversion, nous avons lancé un test A/B preset 50/50.`}
          </Text>
          <Text style={text}>
            <strong>{isEn ? "Challenger preset:" : "Preset challenger :"}</strong> {challengerPresetId}
          </Text>
          <Button href={brandStudioUrl} style={button}>
            {isEn ? "View experiment in Brand Studio" : "Voir l'expérience dans Brand Studio"}
          </Button>
          <Text style={muted}>
            {isEn
              ? "The winner auto-applies after 7 days. You can stop the test anytime in Brand Studio."
              : "Le gagnant s'applique automatiquement après 7 jours. Vous pouvez arrêter le test à tout moment dans Brand Studio."}
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
  backgroundColor: "#d97706",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
}
