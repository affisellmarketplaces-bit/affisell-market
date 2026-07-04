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

export type BrandPresetAbWinnerEmailProps = {
  name: string
  storeName: string
  winnerLabel: string
  reasonLine: string
  viewsControl: number
  viewsChallenger: number
  brandStudioUrl: string
  locale?: "fr" | "en"
}

export function BrandPresetAbWinnerEmail({
  name,
  storeName,
  winnerLabel,
  reasonLine,
  viewsControl,
  viewsChallenger,
  brandStudioUrl,
  locale = "fr",
}: BrandPresetAbWinnerEmailProps) {
  const isEn = locale === "en"
  return (
    <Html>
      <Head />
      <Preview>
        {isEn
          ? `${storeName} — preset A/B winner applied (${winnerLabel})`
          : `${storeName} — gagnant A/B preset appliqué (${winnerLabel})`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isEn ? "Your preset A/B test has a winner" : "Votre test A/B preset a un gagnant"}
          </Heading>
          <Text style={text}>{isEn ? `Hi ${name},` : `Bonjour ${name},`}</Text>
          <Text style={text}>
            {isEn
              ? `We applied the winning preset on "${storeName}". ${reasonLine}`
              : `Nous avons appliqué le preset gagnant sur « ${storeName} ». ${reasonLine}`}
          </Text>
          <Text style={text}>
            <strong>{isEn ? "Winner:" : "Gagnant :"}</strong> {winnerLabel}
          </Text>
          <Text style={text}>
            {isEn
              ? `Final views — control: ${viewsControl} · challenger: ${viewsChallenger}`
              : `Vues finales — contrôle : ${viewsControl} · challenger : ${viewsChallenger}`}
          </Text>
          <Button href={brandStudioUrl} style={button}>
            {isEn ? "Open Brand Studio" : "Ouvrir Brand Studio"}
          </Button>
          <Text style={muted}>
            {isEn
              ? "Your storefront now uses the winning theme. Start a new experiment anytime in Brand Studio."
              : "Votre vitrine utilise désormais le thème gagnant. Relancez une expérience quand vous voulez dans Brand Studio."}
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
  backgroundColor: "#0891b2",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
}
