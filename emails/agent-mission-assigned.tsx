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

export type AgentMissionAssignedEmailProps = {
  agentName: string
  missionTypeLabel: string
  productName: string
  instructions: string | null
  dashboardUrl: string
}

export function AgentMissionAssignedEmail({
  agentName,
  missionTypeLabel,
  productName,
  instructions,
  dashboardUrl,
}: AgentMissionAssignedEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Nouvelle mission Agent Network — {missionTypeLabel}</Preview>
      <Body style={{ backgroundColor: "#0f172a", fontFamily: "Inter, sans-serif", padding: "24px" }}>
        <Container style={{ maxWidth: "520px", margin: "0 auto" }}>
          <Section
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "12px",
              padding: "28px",
              border: "1px solid #334155",
            }}
          >
            <Text style={{ color: "#67e8f9", fontSize: "12px", fontWeight: 600, margin: 0 }}>
              Affisell Agent Network
            </Text>
            <Heading style={{ color: "#f8fafc", fontSize: "22px", marginTop: "12px" }}>
              Nouvelle mission assignée
            </Heading>
            <Text style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: "22px" }}>
              Bonjour {agentName}, une mission vous a été assignée automatiquement.
            </Text>
            <Section
              style={{
                backgroundColor: "#0f172a",
                borderRadius: "8px",
                padding: "16px",
                marginTop: "16px",
              }}
            >
              <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Type</Text>
              <Text style={{ color: "#f1f5f9", fontSize: "15px", margin: "0 0 12px", fontWeight: 600 }}>
                {missionTypeLabel}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Produit</Text>
              <Text style={{ color: "#f1f5f9", fontSize: "15px", margin: 0 }}>{productName}</Text>
              {instructions ? (
                <>
                  <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "12px 0 4px" }}>Brief</Text>
                  <Text style={{ color: "#e2e8f0", fontSize: "13px", margin: 0 }}>{instructions}</Text>
                </>
              ) : null}
            </Section>
            <Button
              href={dashboardUrl}
              style={{
                backgroundColor: "#06b6d4",
                color: "#0f172a",
                fontWeight: 600,
                borderRadius: "8px",
                padding: "12px 20px",
                marginTop: "20px",
                fontSize: "14px",
              }}
            >
              Ouvrir mon espace agent
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
