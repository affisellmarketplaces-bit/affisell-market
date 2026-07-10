import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export type AffiliateReferralBonusEmailProps = {
  filleulName: string
  amountLabel: string
  referralUrl: string
  locale: "fr" | "en"
}

export function AffiliateReferralBonusEmail({
  filleulName,
  amountLabel,
  referralUrl,
  locale,
}: AffiliateReferralBonusEmailProps) {
  const isEn = locale === "en"
  const preview = isEn
    ? `You earned ${amountLabel} in referral bonus`
    : `Tu as gagné ${amountLabel} de parrainage`
  const heading = isEn ? "Referral bonus credited 💰" : "Bonus parrainage crédité 💰"
  const intro = isEn
    ? `Your referral ${filleulName} just generated a sale. +${amountLabel} was added to your referral balance.`
    : `Ton filleul ${filleulName} vient de générer une vente. +${amountLabel} ajouté à ton solde parrainage.`
  const cta = isEn ? "View my referrals" : "Voir mes parrainages"

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>✦ Affisell Partner</Text>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>{intro}</Text>
          <Section style={box}>
            <Text style={label}>{isEn ? "Bonus" : "Bonus"}</Text>
            <Text style={valueHighlight}>+{amountLabel}</Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={referralUrl} style={button}>
              {cta}
            </Button>
          </Section>
          <Text style={footer}>
            {isEn
              ? "Keep sharing your link — 10% of your referrals' net earnings on every sale."
              : "Continue de partager ton lien — 10% des gains nets de tes filleuls à chaque vente."}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#0f172a", fontFamily: "system-ui, sans-serif" }
const container = { margin: "0 auto", padding: "32px 20px", maxWidth: "520px" }
const badge = {
  color: "#c4b5fd",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
}
const h1 = { color: "#f8fafc", fontSize: "24px", fontWeight: 700, margin: "12px 0" }
const text = { color: "#cbd5e1", fontSize: "15px", lineHeight: "24px" }
const box = {
  backgroundColor: "#1e293b",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "20px 0",
}
const label = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
}
const valueHighlight = { color: "#a7f3d0", fontSize: "22px", fontWeight: 700, margin: "0" }
const button = {
  backgroundColor: "#7c3aed",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 700,
  padding: "12px 24px",
  textDecoration: "none",
}
const footer = { color: "#64748b", fontSize: "12px", lineHeight: "20px", marginTop: "24px" }
