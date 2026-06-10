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

export type AgentMissionReportSupplierEmailProps = {
  productName: string
  missionTypeLabel: string
  statusLabel: string
  passed: boolean
  reportSummary: string
  photoCount: number
  agentName: string
  supplyHubUrl: string
}

export function AgentMissionReportSupplierEmail({
  productName,
  missionTypeLabel,
  statusLabel,
  passed,
  reportSummary,
  photoCount,
  agentName,
  supplyHubUrl,
}: AgentMissionReportSupplierEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>
        Rapport agent — {productName} ({statusLabel})
      </Preview>
      <Body style={{ backgroundColor: "#fafafa", fontFamily: "Inter, sans-serif", padding: "24px" }}>
        <Container style={{ maxWidth: "520px", margin: "0 auto" }}>
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "28px",
              border: "1px solid #e4e4e7",
            }}
          >
            <Text style={{ color: passed ? "#059669" : "#dc2626", fontSize: "12px", fontWeight: 600 }}>
              {statusLabel}
            </Text>
            <Heading style={{ color: "#18181b", fontSize: "20px", marginTop: "8px" }}>
              Rapport Agent Network
            </Heading>
            <Text style={{ color: "#52525b", fontSize: "14px" }}>
              <strong>{productName}</strong> · {missionTypeLabel} · Agent {agentName}
            </Text>
            <Section
              style={{
                backgroundColor: "#f4f4f5",
                borderRadius: "8px",
                padding: "16px",
                marginTop: "16px",
              }}
            >
              <Text style={{ color: "#3f3f46", fontSize: "14px", fontStyle: "italic", margin: 0 }}>
                « {reportSummary} »
              </Text>
              {photoCount > 0 ? (
                <Text style={{ color: "#71717a", fontSize: "12px", marginTop: "12px", marginBottom: 0 }}>
                  {photoCount} photo(s) QC disponibles dans le Supply Hub.
                </Text>
              ) : null}
            </Section>
            {!passed ? (
              <Text style={{ color: "#b45309", fontSize: "13px", marginTop: "16px" }}>
                Quality Gate : l&apos;auto-buy de ce SKU a été coupé automatiquement.
              </Text>
            ) : null}
            <Button
              href={supplyHubUrl}
              style={{
                backgroundColor: "#18181b",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "12px 20px",
                marginTop: "20px",
                fontSize: "14px",
              }}
            >
              Voir dans le Supply Hub
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
