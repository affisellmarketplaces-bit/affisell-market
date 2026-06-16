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

export type ExpansionDigestEmailProps = {
  bodyText: string
  adminConsoleUrl: string
  filteredConsoleUrl?: string | null
  graduationPendingCount?: number
  graduatedBrowseLinks?: Array<{ label: string; url: string }>
}

export function ExpansionDigestEmail({
  bodyText,
  adminConsoleUrl,
  filteredConsoleUrl = null,
  graduationPendingCount = 0,
  graduatedBrowseLinks = [],
}: ExpansionDigestEmailProps) {
  const showGraduationCta = graduationPendingCount > 0
  const showBrowseLinks = graduatedBrowseLinks.length > 0
  const showFilteredConsoleCta = Boolean(filteredConsoleUrl)

  return (
    <Html>
      <Head />
      <Preview>Affisell expansion digest</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Expansion ROW digest</Heading>
          <Text style={text}>{bodyText}</Text>
          {showFilteredConsoleCta ? (
            <Section style={multiAlertBox}>
              <Text style={multiAlertBadge}>Multi-alert</Text>
              <Text style={multiAlertTitle}>Countries with ≥2 email alert signals this month</Text>
              <Text style={multiAlertBody}>
                Open the pre-filtered admin console to review ZIP exports and signal details.
              </Text>
              <Section style={{ textAlign: "center", margin: "16px 0 0" }}>
                <Button href={filteredConsoleUrl!} style={buttonMultiAlert}>
                  Open filtered console
                </Button>
              </Section>
            </Section>
          ) : null}
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={adminConsoleUrl} style={buttonPrimary}>
              Open expansion console
            </Button>
          </Section>
          {showBrowseLinks ? (
            <Section style={browseBox}>
              <Text style={browseTitle}>Graduated this month — browse catalog</Text>
              {graduatedBrowseLinks.map((link) => (
                <Section key={link.url} style={{ textAlign: "center", margin: "12px 0" }}>
                  <Button href={link.url} style={buttonBrowse}>
                    Shop {link.label}
                  </Button>
                </Section>
              ))}
            </Section>
          ) : null}
          {showGraduationCta ? (
            <Section style={graduationBox}>
              <Text style={graduationTitle}>
                {graduationPendingCount} graduation email batch
                {graduationPendingCount === 1 ? "" : "es"} pending
              </Text>
              <Text style={graduationBody}>
                Send buyer re-engagement from the admin console or wait for the daily expansion-ops
                retry cron.
              </Text>
              <Button href={adminConsoleUrl} style={buttonSecondary}>
                Send graduation emails
              </Button>
            </Section>
          ) : null}
          <Section>
            <Text style={footer}>Automated weekly summary — Affisell Admin</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
}
const h1 = { fontSize: "20px", fontWeight: 700, color: "#18181b", margin: "0 0 16px" }
const text = { fontSize: "14px", lineHeight: "22px", color: "#3f3f46", whiteSpace: "pre-wrap" as const }
const buttonPrimary = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
}
const browseBox = {
  margin: "0 0 16px",
  padding: "16px",
  borderRadius: "12px",
  backgroundColor: "#f5f3ff",
  border: "1px solid #ddd6fe",
}
const browseTitle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#5b21b6",
  margin: "0 0 8px",
  textAlign: "center" as const,
}
const buttonBrowse = {
  backgroundColor: "#6d28d9",
  color: "#ffffff",
  padding: "10px 18px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
}
const graduationBox = {
  margin: "0 0 16px",
  padding: "16px",
  borderRadius: "12px",
  backgroundColor: "#fff7ed",
  border: "1px solid #fed7aa",
}
const graduationTitle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#9a3412",
  margin: "0 0 8px",
}
const graduationBody = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#7c2d12",
  margin: "0 0 12px",
}
const buttonSecondary = {
  backgroundColor: "#ea580c",
  color: "#ffffff",
  padding: "10px 18px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
}
const multiAlertBox = {
  margin: "0 0 16px",
  padding: "16px",
  borderRadius: "12px",
  backgroundColor: "#fff1f2",
  border: "1px solid #fecdd3",
}
const multiAlertBadge = {
  display: "inline-block",
  margin: "0 0 8px",
  padding: "4px 10px",
  borderRadius: "999px",
  backgroundColor: "#be123c",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
}
const multiAlertTitle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#9f1239",
  margin: "0 0 8px",
}
const multiAlertBody = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#881337",
  margin: "0",
}
const buttonMultiAlert = {
  backgroundColor: "#be123c",
  color: "#ffffff",
  padding: "10px 18px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
}
const footer = { fontSize: "12px", color: "#71717a", margin: "24px 0 0" }

export default ExpansionDigestEmail

ExpansionDigestEmail.PreviewProps = {
  bodyText: "Region: EU\nGraduation emails pending: 2",
  adminConsoleUrl: "https://affisell.com/admin/expansion",
  filteredConsoleUrl: "https://affisell.com/admin/expansion?multiAlert=1",
  graduationPendingCount: 2,
  graduatedBrowseLinks: [
    { label: "Japan", url: "https://affisell.com/shops/browse?shipsTo=jp" },
  ],
} satisfies ExpansionDigestEmailProps
