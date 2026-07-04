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

export type BrandPulseWeeklyDigestEmailProps = {
  name: string
  storeName: string
  score: number
  readyToShare: boolean
  openChecks: string[]
  abSummary?: string | null
  brandStudioUrl: string
  locale?: "fr" | "en"
}

export function BrandPulseWeeklyDigestEmail({
  name,
  storeName,
  score,
  readyToShare,
  openChecks,
  abSummary,
  brandStudioUrl,
  locale = "fr",
}: BrandPulseWeeklyDigestEmailProps) {
  const isEn = locale === "en"
  return (
    <Html>
      <Head />
      <Preview>
        {isEn
          ? `${storeName} Brand Pulse ${score}/100 — weekly recap`
          : `${storeName} Brand Pulse ${score}/100 — récap hebdo`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{isEn ? "Brand Pulse weekly" : "Brand Pulse — semaine"}</Heading>
          <Text style={text}>{isEn ? `Hi ${name},` : `Bonjour ${name},`}</Text>
          <Text style={text}>
            {isEn
              ? `"${storeName}" scores ${score}/100${readyToShare ? " — launch-ready!" : "."}`
              : `« ${storeName} » : ${score}/100${readyToShare ? " — prêt à partager !" : "."}`}
          </Text>
          {openChecks.length > 0 ? (
            <>
              <Text style={text}>{isEn ? "Top actions:" : "Actions prioritaires :"}</Text>
              {openChecks.map((line) => (
                <Text key={line} style={bullet}>
                  • {line}
                </Text>
              ))}
            </>
          ) : null}
          {abSummary ? <Text style={text}>{abSummary}</Text> : null}
          <Button href={brandStudioUrl} style={button}>
            {isEn ? "Open Brand Studio" : "Ouvrir Brand Studio"}
          </Button>
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
const bullet = { fontSize: "14px", lineHeight: "1.45", color: "#52525b", margin: "0 0 6px" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
}
