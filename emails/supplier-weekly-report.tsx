import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export type SupplierWeeklyReportEmailProps = {
  name: string
  weekLabel: string
  revenueLabel: string
  topAffiliateName: string
  topAffiliateRevenueLabel: string
  topSkuName: string
  topSkuEpcLabel: string
  actionTip: string
  dashboardUrl: string
}

export function SupplierWeeklyReportEmail({
  name,
  weekLabel,
  revenueLabel,
  topAffiliateName,
  topAffiliateRevenueLabel,
  topSkuName,
  topSkuEpcLabel,
  actionTip,
  dashboardUrl,
}: SupplierWeeklyReportEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {revenueLabel} cette semaine — top affilié {topAffiliateName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>✦ Rapport fournisseur</Text>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            Voici ton rapport Affisell <strong>{weekLabel}</strong>.
          </Text>
          <Section style={box}>
            <Text style={label}>CA net semaine</Text>
            <Text style={valueHighlight}>{revenueLabel}</Text>
            <Text style={label}>Top affilié</Text>
            <Text style={value}>
              {topAffiliateName} · {topAffiliateRevenueLabel}
            </Text>
            <Text style={label}>Top SKU (EPC)</Text>
            <Text style={value}>
              {topSkuName} · {topSkuEpcLabel}
            </Text>
          </Section>
          <Text style={text}>
            <strong>Conseil :</strong> {actionTip}
          </Text>
          <Button href={dashboardUrl} style={button}>
            Ouvrir mon dashboard
          </Button>
          <Text style={muted}>L&apos;équipe Affisell</Text>
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
const badge = {
  color: "#059669",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase" as const,
  margin: "0 0 12px",
}
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 12px" }
const box = {
  backgroundColor: "#f0fdf4",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "16px 0",
}
const label = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  margin: "12px 0 4px",
}
const value = { color: "#1e293b", fontSize: "15px", margin: "0 0 4px" }
const valueHighlight = { color: "#047857", fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }
const button = {
  backgroundColor: "#059669",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 4px",
}
const muted = { fontSize: "13px", lineHeight: "20px", color: "#71717a", margin: "16px 0 0" }

export default SupplierWeeklyReportEmail
